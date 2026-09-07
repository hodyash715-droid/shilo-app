-- ============================================================
-- שילה — עובד שמקושר לחשבון שנמחק.
-- employees.user_id לא הצביע על auth.users, ולכן מחיקת חשבון
-- השאירה את העובד "מחובר" לנצח: הוא לא יכול להיכנס, ושי לא
-- יכול להנפיק לו קוד חדש כי הכרטיס מציג "כבר מחובר".
-- בטוח להרצה חוזרת.
-- ============================================================

-- ניתוק עובדים שהחשבון שלהם כבר לא קיים
update public.employees e
   set user_id = null
 where user_id is not null
   and not exists (select 1 from auth.users u where u.id = e.user_id);

-- מנויי Push של משתמשים שנמחקו
delete from public.push_subs s
 where not exists (select 1 from auth.users u where u.id = s.user_id);

-- מעכשיו זה מתנקה מעצמו
alter table public.employees drop constraint if exists employees_user_fk;
alter table public.employees add constraint employees_user_fk
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.push_subs drop constraint if exists push_subs_user_fk;
alter table public.push_subs add constraint push_subs_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

-- מי שנותק וצריך קוד חדש — שי יראה אותם עם "הנפק קוד חדש"
select name,
       case when user_id is null and join_code is null
            then 'צריך קוד חדש' else 'תקין' end as מצב
  from public.employees
 order by name;
