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
