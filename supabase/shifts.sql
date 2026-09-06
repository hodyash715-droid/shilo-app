-- ============================================================
-- שילה — טבלת משמרות (הקמה/פירוק). הרץ ב-Supabase → SQL Editor.
-- ============================================================

create table if not exists public.shifts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  job_id     uuid references public.jobs(id) on delete cascade,
  kind       text default 'setup',   -- setup (הקמה) | teardown (פירוק)
  date       date,
  start_time text,                    -- 'HH:MM'
  end_time   text,
  need       integer default 1,       -- כמה אנשי צוות דרושים
  assigned   jsonb default '[]'::jsonb -- מזהי עובדים משובצים
);

alter table public.shifts enable row level security;

drop policy if exists "sh read"   on public.shifts;
drop policy if exists "sh insert" on public.shifts;
drop policy if exists "sh update" on public.shifts;
drop policy if exists "sh delete" on public.shifts;

create policy "sh read"   on public.shifts for select to authenticated using (true);
create policy "sh insert" on public.shifts for insert to authenticated with check (true);
create policy "sh update" on public.shifts for update to authenticated using (true) with check (true);
create policy "sh delete" on public.shifts for delete to authenticated using (true);
