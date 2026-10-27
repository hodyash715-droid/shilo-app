-- ============================================================
-- הרשאת מנהל: מרשימה קבועה בקוד אל תיבת סימון בכרטיס העובד.
--
-- עד היום is_manager() השוותה אימייל לרשימה בתוך הפונקציה עצמה,
-- וכל מנהל חדש דרש שינוי קוד, בנייה ופריסה. מעכשיו יש עמודה
-- is_manager על employees, ושי מסמן מנהלים בעצמו מהמסך.
--
-- שי נשאר ברשימה הקבועה כרשת ביטחון: גם אם כל התיבות יתבטלו
-- בטעות, הוא עדיין נכנס ויכול לתקן. אי אפשר לנעול את כולם בחוץ.
--
-- בטיחות: עובד רגיל יכול רק *לקרוא* את הכרטיס שלו — המדיניות
-- "emp self read" היא select בלבד, בלי update. לכן אף אחד לא
-- יכול לסמן את עצמו כמנהל. רק מי שכבר מנהל כותב לטבלה הזו.
--
-- הרצה: Supabase ← SQL Editor ← הדבק ← Run. בטוח להריץ שוב ושוב.
-- ============================================================

alter table public.employees
  add column if not exists is_manager boolean not null default false;

comment on column public.employees.is_manager is
  'גישת ניהול מלאה. נקבע על ידי מנהל קיים במסך הצוות.';

-- security definer הוא חובה כאן, לא נוחות:
-- הפונקציה קוראת את employees, ועל employees יש מדיניות שקוראת
-- לפונקציה הזו. בלי definer זו לולאה אינסופית. אותה תבנית בדיוק
-- כמו my_employee_id() שכבר עובדת כאן.
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'email', '') in ('shai@shilo.app')
      or exists (
        select 1 from public.employees
        where user_id = auth.uid() and is_manager
      )
$$;

grant execute on function public.is_manager() to authenticated;

-- ---------- בדיקה ----------
-- מי מנהל כרגע, ולמה:
--   select name, is_manager, user_id is not null as "מקושר"
--   from public.employees order by is_manager desc, name;
