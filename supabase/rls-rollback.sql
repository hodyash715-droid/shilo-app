-- ============================================================
-- שילה — ביטול הידוק ההרשאות. חזרה למצב הקודם.
-- הרץ את זה רק אם משהו נשבר אחרי rls.sql.
-- ============================================================

-- עבודות
drop policy if exists "jobs manager all" on public.jobs;
create policy "staff read"   on public.jobs for select to authenticated using (true);
create policy "staff insert" on public.jobs for insert to authenticated with check (true);
create policy "staff update" on public.jobs for update to authenticated using (true) with check (true);
create policy "staff delete" on public.jobs for delete to authenticated using (true);

-- מלאי
drop policy if exists "inv manager all" on public.inventory;
create policy "inv read"   on public.inventory for select to authenticated using (true);
create policy "inv insert" on public.inventory for insert to authenticated with check (true);
create policy "inv update" on public.inventory for update to authenticated using (true) with check (true);
create policy "inv delete" on public.inventory for delete to authenticated using (true);

-- עובדים
drop policy if exists "emp manager all" on public.employees;
drop policy if exists "emp self read"   on public.employees;
create policy "emp read"   on public.employees for select to authenticated using (true);
create policy "emp insert" on public.employees for insert to authenticated with check (true);
create policy "emp update" on public.employees for update to authenticated using (true) with check (true);
create policy "emp delete" on public.employees for delete to authenticated using (true);

-- משמרות
drop policy if exists "sh manager all" on public.shifts;
drop policy if exists "sh worker read" on public.shifts;
create policy "sh read"   on public.shifts for select to authenticated using (true);
create policy "sh insert" on public.shifts for insert to authenticated with check (true);
create policy "sh update" on public.shifts for update to authenticated using (true) with check (true);
create policy "sh delete" on public.shifts for delete to authenticated using (true);

-- זמינות
drop policy if exists "av manager all" on public.availability;
drop policy if exists "av worker own"  on public.availability;
create policy "av read"   on public.availability for select to authenticated using (true);
create policy "av insert" on public.availability for insert to authenticated with check (true);
create policy "av update" on public.availability for update to authenticated using (true) with check (true);
create policy "av delete" on public.availability for delete to authenticated using (true);
