-- ============================================================
-- שילה — זמינות עובדים. הרץ ב-Supabase → SQL Editor.
-- ============================================================

create table if not exists public.availability (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  employee_id uuid references public.employees(id) on delete cascade,
  date        date not null,
  status      text not null,   -- full (פנוי כל היום) | morning | evening | off
  unique (employee_id, date)
);

alter table public.availability enable row level security;

drop policy if exists "av read"   on public.availability;
drop policy if exists "av insert" on public.availability;
drop policy if exists "av update" on public.availability;
drop policy if exists "av delete" on public.availability;

create policy "av read"   on public.availability for select to authenticated using (true);
create policy "av insert" on public.availability for insert to authenticated with check (true);
create policy "av update" on public.availability for update to authenticated using (true) with check (true);
create policy "av delete" on public.availability for delete to authenticated using (true);
