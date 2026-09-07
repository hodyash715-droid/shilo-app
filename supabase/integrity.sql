-- ============================================================
-- שילה — שלמות נתונים. מוחקים משאירים אחריהם יתומים:
-- קוליסות והתראות שורדות מחיקת עבודה, עבודות מצביעות על מפיקה
-- שנמחקה, ועובד שנמחק נשאר משובץ למשמרת ומסתיר חוסר בצוות.
-- בטוח להרצה חוזרת.
-- ============================================================

-- ---------- ניקוי מה שכבר יתום ----------
update public.koolisot k set job_id = null
 where job_id is not null
   and not exists (select 1 from public.jobs j where j.id = k.job_id);

delete from public.notifications n
 where job_id is not null
   and not exists (select 1 from public.jobs j where j.id = n.job_id);

update public.jobs j set client_id = null
 where client_id is not null
   and not exists (select 1 from public.clients c where c.id = j.client_id);

delete from public.availability a
 where not exists (select 1 from public.employees e where e.id = a.employee_id);

-- מזהי עובדים שנמחקו, שנשארו תקועים במשמרות
update public.shifts s
   set assigned = coalesce((
     select jsonb_agg(x)
       from jsonb_array_elements_text(s.assigned) as t(x)
      where exists (select 1 from public.employees e where e.id::text = x)
   ), '[]'::jsonb)
 where s.assigned is not null and s.assigned <> '[]'::jsonb;

-- ---------- מפתחות זרים ----------
alter table public.koolisot      drop constraint if exists koolisot_job_fk;
alter table public.notifications drop constraint if exists notifications_job_fk;
alter table public.jobs          drop constraint if exists jobs_client_fk;
alter table public.availability  drop constraint if exists availability_emp_fk;
alter table public.push_subs     drop constraint if exists push_subs_emp_fk;

-- העיצוב עצמו שווה משהו גם בלי העבודה — מנתקים, לא מוחקים
alter table public.koolisot add constraint koolisot_job_fk
  foreign key (job_id) references public.jobs(id) on delete set null;

-- התראה על עבודה שנמחקה היא רעש
alter table public.notifications add constraint notifications_job_fk
  foreign key (job_id) references public.jobs(id) on delete cascade;

alter table public.jobs add constraint jobs_client_fk
  foreign key (client_id) references public.clients(id) on delete set null;

alter table public.availability add constraint availability_emp_fk
  foreign key (employee_id) references public.employees(id) on delete cascade;

alter table public.push_subs add constraint push_subs_emp_fk
  foreign key (employee_id) references public.employees(id) on delete cascade;

-- ---------- עובד שנמחק יורד מהמשמרות ----------
-- בלי זה המשמרת נראית מאוישת, ושי מגיע לאירוע בחוסר.
create or replace function public.strip_deleted_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.shifts
     set assigned = coalesce((
       select jsonb_agg(x)
         from jsonb_array_elements_text(assigned) as t(x)
        where x <> old.id::text
     ), '[]'::jsonb)
   where assigned ? old.id::text;
  return old;
end $$;

drop trigger if exists employees_strip_shifts on public.employees;
create trigger employees_strip_shifts after delete on public.employees
  for each row execute function public.strip_deleted_employee();
