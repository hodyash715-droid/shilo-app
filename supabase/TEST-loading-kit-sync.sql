-- ============================================================
-- בדיקה של זיהוי הערכה הקבועה לפי רשומה, מול Postgres אמיתי.
--
-- הכל בתוך begin/rollback — לא נשאר שום זכר במסד.
-- התרחיש החשוב ביותר כאן הוא מספר 5: ref_id של שורת ערכה מצביע
-- על loading_defaults ולא על koolisot, ובלי סינון לפי source
-- פונקציית ניקוי היתומים הייתה מוחקת את כל הכלים.
--
-- להריץ הכל בבת אחת. התוצאה היא טבלה אחת עם ✓ או ✗.
-- ============================================================

begin;
set local request.jwt.claims = '{"email":"shai@shilo.app"}';

create temp table t(n int, step text, got text, want text) on commit drop;

-- ערכה נקייה לבדיקה: מכבים את הקיימת ומוסיפים פריט משלנו
update public.loading_defaults set active = false where active;

insert into public.loading_defaults (id, label, qty, sort, active)
values ('00000000-0000-0000-0000-0000000000c1', 'מברגה', '1', 10, true);

insert into public.jobs (id, title, status, price, items, team)
values ('00000000-0000-0000-0000-0000000000aa', 'בדיקה זמנית', 'inquiry', 0,
        '[]'::jsonb, '[]'::jsonb);

-- 1. זריעה ראשונה
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');
insert into t values (1, 'זריעה ראשונה — שורות ערכה',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit'), '1');

-- העובד מסמן שהכלי הועמס
update public.job_loading set done = true
 where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit';

-- 2. שי משנה את השם — זה הבאג: קודם נוספה שורה שנייה
update public.loading_defaults set label = 'מברגה גדולה'
 where id='00000000-0000-0000-0000-0000000000c1';
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');

insert into t values (2, 'אחרי שינוי שם — שורות ערכה',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit'), '1');
insert into t values (3, 'אחרי שינוי שם — השם',
  (select label from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit'), 'מברגה גדולה');
insert into t values (4, 'אחרי שינוי שם — הסימון נשמר',
  (select done::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit'), 'true');

-- 5. ניקוי היתומים לא נוגע בכלים
--    (ref_id שלהם מצביע על loading_defaults, לא על koolisot)
insert into t values (5, 'ניקוי יתומים — כלים שנמחקו בטעות',
  public.clean_job_loading('00000000-0000-0000-0000-0000000000aa')::text, '0');
insert into t values (6, 'אחרי הניקוי — שורות ערכה שרדו',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit'), '1');

-- 7. שינוי כמות
update public.loading_defaults set qty = 'קופסה'
 where id='00000000-0000-0000-0000-0000000000c1';
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');
insert into t values (7, 'אחרי שינוי כמות',
  (select qty from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit'), 'קופסה');

-- 8. קריאה חוזרת בלי שינוי
insert into t values (8, 'ללא שינוי — שורות שנוספו',
  public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa')::text, '0');

-- 9. כיבוי פריט לא נוגע ברשימות עבר
update public.loading_defaults set active = false
 where id='00000000-0000-0000-0000-0000000000c1';
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');
insert into t values (9, 'אחרי כיבוי — השורה נשארה',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='kit'), '1');

select n as "#", step as "שלב", got as "יצא", want as "צפוי",
       case when got is not distinct from want then '✓' else '✗ נכשל' end as "תוצאה"
  from t order by n;

rollback;
