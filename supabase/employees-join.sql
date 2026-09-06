-- ============================================================
-- שילה — קוד הצטרפות לעובדים + קישור לחשבון.
-- בטוח להרצה חוזרת.
-- ============================================================

alter table public.employees add column if not exists join_code text;
alter table public.employees add column if not exists user_id   uuid;

-- קוד ייחודי לכל עובד
create unique index if not exists employees_join_code_uniq
  on public.employees (join_code) where join_code is not null;

-- מייצר קוד לעובדים קיימים שאין להם
update public.employees
   set join_code = upper(substr(md5(random()::text || id::text), 1, 6))
 where join_code is null;
