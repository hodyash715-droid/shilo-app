-- ============================================================
-- שילה — פרטי לוגיסטיקה של האירוע כשדות אמיתיים.
-- החלופה הייתה לדחוס הכל לתוך note כטקסט; אז אי אפשר לשאול
-- "למי יש פירוק מחר" או לסנן לפי סוג שירות.
-- בטוח להרצה חוזרת.
-- ============================================================

alter table public.jobs add column if not exists service        text default 'setup';
alter table public.jobs add column if not exists setup_date     date;
alter table public.jobs add column if not exists setup_time     time;
alter table public.jobs add column if not exists teardown_date  date;
alter table public.jobs add column if not exists teardown_time  time;
alter table public.jobs add column if not exists contact_name   text;
alter table public.jobs add column if not exists contact_phone  text;
alter table public.jobs add column if not exists access_notes   text;
alter table public.jobs add column if not exists reference_url  text;

-- שליפה מהירה של "מה יש היום/מחר בשטח"
create index if not exists jobs_setup_idx    on public.jobs (setup_date);
create index if not exists jobs_teardown_idx on public.jobs (teardown_date);

-- ---------- דף הלקוח: קליטת הפרטים החדשים ----------
drop function if exists public.client_submit_order(text, text, date, text, text, text, text, jsonb);

create or replace function public.client_submit_order(
  p_token text, p_title text, p_event_date date,
  p_venue text, p_address text, p_time text, p_note text, p_items jsonb,
  p_service text default 'setup',
  p_setup_date date default null, p_setup_time text default null,
  p_teardown_date date default null, p_teardown_time text default null,
  p_contact_name text default null, p_contact_phone text default null,
  p_access text default null, p_reference text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare c public.clients; v_id uuid; v_title text; v_time text;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then raise exception 'invalid token'; end if;

  v_title := coalesce(nullif(btrim(p_title), ''), 'הזמנה חדשה');
  v_time  := nullif(btrim(coalesce(p_time, '')), '');

  insert into public.jobs
    (title, client, contact, event_date, venue, address, event_time, status, price,
     items, team, note, quote_status, client_id,
     service, setup_date, setup_time, teardown_date, teardown_time,
     contact_name, contact_phone, access_notes, reference_url)
  values
    (v_title, c.name, c.phone, p_event_date,
     nullif(btrim(p_venue), ''), nullif(btrim(p_address), ''),
     v_time::time, 'inquiry', 0,
     coalesce(p_items, '[]'::jsonb), '[]'::jsonb, nullif(btrim(p_note), ''),
     'needs_quote', c.id,
     case when p_service in ('setup','delivery','pickup') then p_service else 'setup' end,
     p_setup_date, nullif(btrim(coalesce(p_setup_time, '')), '')::time,
     p_teardown_date, nullif(btrim(coalesce(p_teardown_time, '')), '')::time,
     nullif(btrim(coalesce(p_contact_name, '')), ''),
     nullif(btrim(coalesce(p_contact_phone, '')), ''),
     nullif(btrim(coalesce(p_access, '')), ''),
     nullif(btrim(coalesce(p_reference, '')), ''))
  returning id into v_id;

  insert into public.notifications (kind, title, body, job_id, audience)
  values ('order', 'הזמנה חדשה מ' || c.name,
          v_title || coalesce(' · ' || to_char(p_event_date, 'DD.MM.YYYY'), ''),
          v_id, 'manager');

  return v_id;
end $$;

grant execute on function public.client_submit_order(
  text,text,date,text,text,text,text,jsonb,text,date,text,date,text,text,text,text,text
) to anon, authenticated;
