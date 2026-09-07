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
