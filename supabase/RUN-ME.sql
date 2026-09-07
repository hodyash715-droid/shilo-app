-- ============================================================
-- שילה — הרצה אחת. הדבק הכל ב-Supabase > SQL Editor ולחץ Run.
-- כולל: פרטי אירוע (חלק 1) + מרכז התראות (חלק 2).
-- בטוח להרצה חוזרת.
-- ============================================================


-- ############ חלק 1 מתוך 2 — פרטי אירוע ############

-- ============================================================
-- שילה — פרטי אירוע מורחבים: מספר הזמנה, כתובת, שעה, מפיקה.
-- בטוח להרצה חוזרת.
-- ============================================================

-- מספר הזמנה רץ, מתחיל מ-1001
create sequence if not exists public.job_order_seq start 1001;

alter table public.jobs add column if not exists order_no   integer;
alter table public.jobs add column if not exists address    text;
alter table public.jobs add column if not exists event_time time;

alter table public.jobs alter column order_no set default nextval('public.job_order_seq');

-- מספור לעבודות שכבר קיימות, לפי סדר הפתיחה
update public.jobs j
   set order_no = nextval('public.job_order_seq')
 where j.order_no is null;

create unique index if not exists jobs_order_no_key on public.jobs (order_no);

-- ---------- דף הלקוח: גם כתובת ושעה ----------
drop function if exists public.client_submit_order(text, text, date, text, text, jsonb);

create or replace function public.client_submit_order(
  p_token text, p_title text, p_event_date date,
  p_venue text, p_address text, p_time text, p_note text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare c public.clients; v_id uuid;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then raise exception 'invalid token'; end if;

  insert into public.jobs
    (title, client, contact, event_date, venue, address, event_time, status, price,
     items, team, note, quote_status, client_id)
  values
    (coalesce(nullif(btrim(p_title), ''), 'הזמנה חדשה'), c.name, c.phone, p_event_date,
     nullif(btrim(p_venue), ''), nullif(btrim(p_address), ''),
     nullif(btrim(coalesce(p_time, '')), '')::time, 'inquiry', 0,
     coalesce(p_items, '[]'::jsonb), '[]'::jsonb, nullif(btrim(p_note), ''),
     'needs_quote', c.id)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- העובד רואה לאן להגיע (בלי מחירים ובלי פריטים) ----------
drop function if exists public.my_job_titles();

create or replace function public.my_job_titles()
returns table (id uuid, title text, client text, venue text, address text, event_time time, event_date date)
language sql stable security definer set search_path = public as $$
  select j.id, j.title, j.client, j.venue, j.address, j.event_time, j.event_date
    from public.jobs j
   where exists (
     select 1 from public.shifts s
      where s.job_id = j.id
        and s.assigned ? public.my_employee_id()::text
   )
$$;
grant execute on function public.my_job_titles() to authenticated;


-- ############ חלק 2 מתוך 2 — מרכז התראות ############

-- ============================================================
-- שילה — מרכז התראות. הרץ אחרי event-details.sql. בטוח להרצה חוזרת.
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  kind        text not null,                    -- order / quote / shift / info
  title       text not null,
  body        text,
  job_id      uuid,
  audience    text not null default 'manager',  -- 'manager' | 'employee'
  employee_id uuid,
  is_read     boolean default false
);

create index if not exists ntf_audience_idx on public.notifications (audience, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "ntf manager all"    on public.notifications;
drop policy if exists "ntf worker read"    on public.notifications;
drop policy if exists "ntf worker update"  on public.notifications;

create policy "ntf manager all" on public.notifications for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "ntf worker read" on public.notifications for select to authenticated
  using (audience = 'employee' and employee_id = public.my_employee_id());

-- העובד רשאי רק לסמן "נקרא" על התראות שלו
create policy "ntf worker update" on public.notifications for update to authenticated
  using (audience = 'employee' and employee_id = public.my_employee_id())
  with check (audience = 'employee' and employee_id = public.my_employee_id());

-- ------------------------------------------------------------
-- שיבוץ עובד למשמרת -> התראה לעובד. טריגר, כדי שיעבוד מכל מקום.
-- ------------------------------------------------------------
create or replace function public.notify_shift_assign()
returns trigger language plpgsql security definer set search_path = public as $$
declare added jsonb; eid text; j record;
begin
  if tg_op = 'INSERT' then
    added := coalesce(new.assigned, '[]'::jsonb);
  else
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into added
      from jsonb_array_elements_text(coalesce(new.assigned, '[]'::jsonb)) as t(x)
     where not (coalesce(old.assigned, '[]'::jsonb) ? x);
  end if;

  if added = '[]'::jsonb then return new; end if;

  select title, venue into j from public.jobs where id = new.job_id;

  for eid in select jsonb_array_elements_text(added) loop
    insert into public.notifications (kind, title, body, job_id, audience, employee_id)
    values (
      'shift',
      'שובצת למשמרת',
      -- shifts.start_time הוא text ('08:00'), ו-date עלול להיות ריק
      coalesce(j.title, 'אירוע')
        || coalesce(' · ' || to_char(new.date, 'DD.MM'), '')
        || coalesce(' ' || new.start_time, '')
        || coalesce(' · ' || j.venue, ''),
      new.job_id, 'employee', eid::uuid
    );
  end loop;
  return new;
end $$;

drop trigger if exists shifts_notify on public.shifts;
create trigger shifts_notify after insert or update of assigned on public.shifts
  for each row execute function public.notify_shift_assign();

-- ------------------------------------------------------------
-- הזמנה חדשה מהמפיקה -> התראה לשי
-- ------------------------------------------------------------
create or replace function public.client_submit_order(
  p_token text, p_title text, p_event_date date,
  p_venue text, p_address text, p_time text, p_note text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare c public.clients; v_id uuid; v_title text;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then raise exception 'invalid token'; end if;

  v_title := coalesce(nullif(btrim(p_title), ''), 'הזמנה חדשה');

  insert into public.jobs
    (title, client, contact, event_date, venue, address, event_time, status, price,
     items, team, note, quote_status, client_id)
  values
    (v_title, c.name, c.phone, p_event_date,
     nullif(btrim(p_venue), ''), nullif(btrim(p_address), ''),
     nullif(btrim(coalesce(p_time, '')), '')::time, 'inquiry', 0,
     coalesce(p_items, '[]'::jsonb), '[]'::jsonb, nullif(btrim(p_note), ''),
     'needs_quote', c.id)
  returning id into v_id;

  insert into public.notifications (kind, title, body, job_id, audience)
  values ('order', 'הזמנה חדשה מ' || c.name,
          v_title || coalesce(' · ' || to_char(p_event_date, 'DD.MM.YYYY'), ''),
          v_id, 'manager');

  return v_id;
end $$;

-- ------------------------------------------------------------
-- החלטת המפיקה על הצעת המחיר -> התראה לשי
-- ------------------------------------------------------------
create or replace function public.client_decide_quote(p_token text, p_job uuid, p_approve boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.clients; n int; v_title text;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then return false; end if;

  update public.jobs
     set quote_status     = case when p_approve then 'approved' else 'rejected' end,
         quote_decided_at = now()
   where id = p_job and client_id = c.id and quote_status = 'sent';

  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  select title into v_title from public.jobs where id = p_job;

  insert into public.notifications (kind, title, body, job_id, audience)
  values ('quote',
          case when p_approve then 'הצעת מחיר אושרה' else 'הצעת מחיר נדחתה' end,
          coalesce(v_title, 'עבודה') || ' · ' || c.name,
          p_job, 'manager');

  return true;
end $$;
