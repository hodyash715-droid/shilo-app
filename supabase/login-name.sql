-- ============================================================
-- כניסה בשם העובד במקום בקוד ההצטרפות.
--
-- עד היום שם המשתמש של עובד היה קוד ההצטרפות שלו (8 תווים), והקוד
-- נעלם מהכרטיס אחרי ההצטרפות. עובד ששכח אותו נתקע. מעכשיו נכנסים
-- עם השם שבכרטיס: "אדם כהן", או רק "אדם" אם אין עוד אדם.
--
-- החשבון עצמו לא משתנה — הוא נשאר <קוד>@shilo.app כמו שנוצר
-- בהצטרפות, והקוד ממשיך לעבוד. הפונקציה רק מתרגמת שם לחשבון.
-- אותו כלל בדיוק נמצא ב-src/loginname.js:
--   1. שם מלא תואם לעובד מחובר אחד
--   2. אחרת שם פרטי תואם לעובד מחובר אחד
--   3. אחרת null — שני עובדים באותו שם לא מכניסים אף אחד
--
-- פתוחה ל-anon בכוונה: היא נקראת לפני הכניסה, כשאין עדיין משתמש.
-- היא מחזירה רק את כתובת החשבון; בלי הסיסמה אין איתה מה לעשות.
--
-- הרצה: Supabase ← SQL Editor ← הדבק ← Run. בטוח להריץ שוב ושוב.
-- ============================================================

create or replace function public.norm_name(s text) returns text
language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(s, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.login_email(p_name text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  q text := public.norm_name(p_name);
  n int;
  v text;
begin
  if q = '' then return null; end if;

  select count(*), min(u.email) into n, v
    from public.employees e join auth.users u on u.id = e.user_id
   where public.norm_name(e.name) = q;
  if n = 1 then return v; end if;
  if n > 1 then return null; end if;

  select count(*), min(u.email) into n, v
    from public.employees e join auth.users u on u.id = e.user_id
   where split_part(public.norm_name(e.name), ' ', 1) = q;
  if n = 1 then return v; end if;
  return null;
end $$;

revoke execute on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;

-- ---------- בדיקה ----------
-- באיזה שם כל עובד נכנס:
--   select name, public.login_email(name) is not null as "נכנס בשם"
--   from public.employees where user_id is not null order by name;
