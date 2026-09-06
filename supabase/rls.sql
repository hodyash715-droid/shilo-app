-- ============================================================
-- שילה — הידוק הרשאות (RLS)
--
-- אחרי הרצה:
--   • שי (shai@shilo.app)  — גישה מלאה לכל הנתונים
--   • עובד                 — רק כרטיס העובד שלו, הזמינות שלו,
--                            והמשמרות שהוא משובץ בהן. בלי הזמנות,
--                            בלי מחירים, בלי מלאי, בלי עובדים אחרים.
--
-- אם משהו משתבש — הרץ את rls-rollback.sql וחוזרים למצב הקודם.
-- ============================================================

-- ---------- פונקציות עזר ----------

-- מי נחשב מנהל. להוספת מנהל נוסף: הוסף אימייל ל-in (...)
create or replace function public.is_manager() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') in ('shai@shilo.app')
$$;

-- מזהה כרטיס העובד של המשתמש המחובר (null אם אין)
create or replace function public.my_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid() limit 1
$$;

-- תפיסת קוד הצטרפות: מקשר את החשבון לכרטיס העובד, פעם אחת בלבד
create or replace function public.claim_employee_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.employees set user_id = auth.uid()
   where join_code = upper(p_code) and user_id is null
   returning id into v_id;
  if v_id is null then
    select id into v_id from public.employees
     where join_code = upper(p_code) and user_id = auth.uid();
  end if;
  return v_id;
end $$;

-- שמות האירועים שהעובד משובץ אליהם — בלי מחירים ובלי פריטים
create or replace function public.my_job_titles()
returns table (id uuid, title text, client text)
language sql stable security definer set search_path = public as $$
  select j.id, j.title, j.client
    from public.jobs j
   where exists (
     select 1 from public.shifts s
      where s.job_id = j.id
        and s.assigned ? public.my_employee_id()::text
   )
$$;

grant execute on function public.is_manager()                 to authenticated;
grant execute on function public.my_employee_id()             to authenticated;
grant execute on function public.claim_employee_code(text)    to authenticated;
grant execute on function public.my_job_titles()              to authenticated;

-- ---------- עבודות: מנהל בלבד ----------
drop policy if exists "staff read"   on public.jobs;
drop policy if exists "staff insert" on public.jobs;
drop policy if exists "staff update" on public.jobs;
drop policy if exists "staff delete" on public.jobs;
drop policy if exists "jobs manager all" on public.jobs;
create policy "jobs manager all" on public.jobs for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ---------- מלאי: מנהל בלבד ----------
drop policy if exists "inv read"   on public.inventory;
drop policy if exists "inv insert" on public.inventory;
drop policy if exists "inv update" on public.inventory;
drop policy if exists "inv delete" on public.inventory;
drop policy if exists "inv manager all" on public.inventory;
create policy "inv manager all" on public.inventory for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ---------- עובדים: מנהל הכל, עובד רואה רק את עצמו ----------
drop policy if exists "emp read"   on public.employees;
drop policy if exists "emp insert" on public.employees;
drop policy if exists "emp update" on public.employees;
drop policy if exists "emp delete" on public.employees;
drop policy if exists "emp manager all" on public.employees;
drop policy if exists "emp self read"   on public.employees;
create policy "emp manager all" on public.employees for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "emp self read" on public.employees for select to authenticated
  using (user_id = auth.uid());

-- ---------- משמרות: מנהל הכל, עובד רואה רק את שלו ----------
drop policy if exists "sh read"   on public.shifts;
drop policy if exists "sh insert" on public.shifts;
drop policy if exists "sh update" on public.shifts;
drop policy if exists "sh delete" on public.shifts;
drop policy if exists "sh manager all"  on public.shifts;
drop policy if exists "sh worker read"  on public.shifts;
create policy "sh manager all" on public.shifts for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "sh worker read" on public.shifts for select to authenticated
  using (
    public.my_employee_id() is not null
    and assigned ? public.my_employee_id()::text
  );

-- ---------- זמינות: מנהל הכל, עובד רק את שלו ----------
drop policy if exists "av read"   on public.availability;
drop policy if exists "av insert" on public.availability;
drop policy if exists "av update" on public.availability;
drop policy if exists "av delete" on public.availability;
drop policy if exists "av manager all" on public.availability;
drop policy if exists "av worker own"  on public.availability;
create policy "av manager all" on public.availability for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "av worker own" on public.availability for all to authenticated
  using (employee_id = public.my_employee_id())
  with check (employee_id = public.my_employee_id());
