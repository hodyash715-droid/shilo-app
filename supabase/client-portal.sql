-- ============================================================
-- שילה — דף הלקוח (מפיקות) + ציר הצעת המחיר
-- קובץ אחד שמחליף את quotes.sql (כולל אותו). בטוח להרצה חוזרת.
-- ============================================================

-- ---------- ציר הצעת המחיר על העבודה ----------
alter table public.jobs add column if not exists quote_status     text default 'none';
alter table public.jobs add column if not exists quote_sent_at    timestamptz;
alter table public.jobs add column if not exists quote_decided_at timestamptz;
alter table public.jobs add column if not exists venue            text;
alter table public.jobs add column if not exists client_id        uuid;

-- ---------- לקוחות / מפיקות ----------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text not null,          -- נועם פ
  company    text,                   -- הפקות ABC
  phone      text,
  token      text unique not null,   -- הקישור הייעודי
  active     boolean default true
);

alter table public.clients enable row level security;
drop policy if exists "cl manager all" on public.clients;
create policy "cl manager all" on public.clients for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ============================================================
-- דף הלקוח עובד ללא התחברות, דרך הטוקן שבקישור.
-- כל הגישה עוברת בפונקציות האלה בלבד — אין גישה ישירה לטבלאות.
-- ============================================================

-- מה נועם רואה: הפרטים שלה, ההזמנות שלה, והקטלוג. בלי מחירים לפריט.
create or replace function public.client_portal(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare c public.clients; res json;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then return null; end if;

  select json_build_object(
    'client', json_build_object('name', c.name, 'company', c.company, 'phone', c.phone),
    'orders', coalesce((
      select json_agg(json_build_object(
        'id', j.id,
        'title', j.title,
        'event_date', j.event_date,
        'venue', j.venue,
        'quote_status', j.quote_status,
        'total', j.price,                    -- סכום אחד בלבד
        'items', coalesce((
          select json_agg(json_build_object('name', it->>'name', 'qty', it->>'qty'))
          from jsonb_array_elements(j.items) it
        ), '[]'::json)
      ) order by j.created_at desc)
      from public.jobs j where j.client_id = c.id
    ), '[]'::json),
    'catalog', coalesce((
      select json_agg(json_build_object('name', i.name, 'category', i.category) order by i.name)
      from public.inventory i
    ), '[]'::json)
  ) into res;
  return res;
end $$;

-- שליחת הזמנה חדשה → נכנסת לשי כ"יש לשלוח הצעת מחיר"
create or replace function public.client_submit_order(
  p_token text, p_title text, p_event_date date,
  p_venue text, p_note text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare c public.clients; v_id uuid;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then raise exception 'invalid token'; end if;

  insert into public.jobs
    (title, client, contact, event_date, venue, status, price,
     items, team, note, quote_status, client_id)
  values
    (coalesce(nullif(btrim(p_title), ''), 'הזמנה חדשה'), c.name, c.phone, p_event_date,
     nullif(btrim(p_venue), ''), 'inquiry', 0,
     coalesce(p_items, '[]'::jsonb), '[]'::jsonb, nullif(btrim(p_note), ''),
     'needs_quote', c.id)
  returning id into v_id;
  return v_id;
end $$;

-- אישור / דחייה של הצעת מחיר שנשלחה
create or replace function public.client_decide_quote(p_token text, p_job uuid, p_approve boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.clients; n int;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then return false; end if;

  update public.jobs
     set quote_status     = case when p_approve then 'approved' else 'rejected' end,
         quote_decided_at = now()
   where id = p_job and client_id = c.id and quote_status = 'sent';

  get diagnostics n = row_count;
  return n > 0;
end $$;

grant execute on function public.client_portal(text)                              to anon, authenticated;
grant execute on function public.client_submit_order(text,text,date,text,text,jsonb) to anon, authenticated;
grant execute on function public.client_decide_quote(text,uuid,boolean)           to anon, authenticated;

-- ---------- מפיקת דמו ----------
insert into public.clients (name, company, phone, token)
select 'נועם פ', 'הפקות ABC', '052-7654321', 'noam-' || substr(md5(random()::text), 1, 8)
where not exists (select 1 from public.clients where name = 'נועם פ');
