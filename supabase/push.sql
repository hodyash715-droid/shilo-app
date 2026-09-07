-- ============================================================
-- שילה — התראות Push. הרץ אחרי RUN-ME.sql. בטוח להרצה חוזרת.
-- ============================================================

create table if not exists public.push_subs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid not null default auth.uid(),
  employee_id uuid,
  is_manager  boolean default false,
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null
);

create index if not exists push_subs_target_idx on public.push_subs (is_manager, employee_id);

alter table public.push_subs enable row level security;

-- כל אחד מנהל רק את המנויים של המכשירים שלו
drop policy if exists "ps own" on public.push_subs;
create policy "ps own" on public.push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- לאן לשלוח: לכל התראה, רשימת המנויים הרלוונטיים.
-- נקרא רק מהפונקציה בשרת (service_role), ולכן לא נחשף ללקוח.
-- ------------------------------------------------------------
create or replace function public.push_targets(p_notification uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.endpoint, s.p256dh, s.auth
    from public.notifications n
    join public.push_subs s
      on (n.audience = 'manager'  and s.is_manager)
      or (n.audience = 'employee' and s.employee_id = n.employee_id)
   where n.id = p_notification
$$;

revoke all on function public.push_targets(uuid) from public, anon, authenticated;
