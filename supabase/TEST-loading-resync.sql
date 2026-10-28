-- ============================================================
-- בדיקה של סנכרון רשימת ההעמסה, מול Postgres אמיתי.
--
-- הכל רץ בתוך טרנזקציה שמסתיימת ב-ROLLBACK: העבודה, הקיר ושורות
-- ההעמסה שנוצרות כאן נעלמים בסוף. שום דבר לא נשאר במסד.
--
-- set local request.jwt.claims מדמה התחברות של שי, כי הפונקציות
-- בודקות is_manager() ובעורך ה-SQL אין משתמש מחובר.
--
-- להריץ הכל בבת אחת. התוצאה היא טבלה אחת עם ✓ או ✗ לכל שלב.
-- ============================================================

begin;
set local request.jwt.claims = '{"email":"shai@shilo.app"}';

create temp table t(n int, step text, got text, want text) on commit drop;

-- עבודה וקיר של 4 קוליסות
insert into public.jobs (id, title, status, price, items, team)
values ('00000000-0000-0000-0000-0000000000aa', 'בדיקה זמנית', 'inquiry', 0,
        '[]'::jsonb, '[]'::jsonb);

insert into public.koolisot (id, name, preview, parts, job_id)
values ('00000000-0000-0000-0000-0000000000bb', 'קיר בדיקה',
        '{"kind":"wall","גובה":240,"רוחב":480}'::jsonb,
        '[{"width":"120"},{"width":"120"},{"width":"120"},{"width":"120"}]'::jsonb,
        '00000000-0000-0000-0000-0000000000aa');

-- 1. זריעה ראשונה
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');
insert into t values (1, 'זריעה ראשונה — שורות קוליסות',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design'), '4');

-- מסמנים שתי קוליסות כהועמסו
update public.job_loading set done = true
 where job_id='00000000-0000-0000-0000-0000000000aa' and source='design'
   and sort in (200, 201);

-- 2. הקיר מתרחב ל-6 קוליסות
update public.koolisot
   set parts = '[{"width":"120"},{"width":"120"},{"width":"120"},
                 {"width":"120"},{"width":"120"},{"width":"120"}]'::jsonb
 where id='00000000-0000-0000-0000-0000000000bb';
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');

insert into t values (2, 'אחרי הרחבה — שורות',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design'), '6');
insert into t values (3, 'אחרי הרחבה — הסימונים נשמרו',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design' and done), '2');
insert into t values (4, 'התווית האחרונה',
  (select label from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design'
    order by sort desc limit 1), 'קוליסה 6 מתוך 6');

-- 3. קריאה חוזרת בלי שינוי — אסור שתיגע
insert into t values (5, 'ללא שינוי — שורות שנוספו',
  public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa')::text, '0');

-- 4. שינוי שם לקיר
update public.koolisot set name='קיר חדש'
 where id='00000000-0000-0000-0000-0000000000bb';
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');
insert into t values (6, 'אחרי שינוי שם — הקבוצה',
  (select distinct grp from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design'), 'קיר חדש');
insert into t values (7, 'אחרי שינוי שם — הסימונים נשמרו',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design' and done), '2');

-- 5. שינוי רוחב
update public.koolisot
   set parts = '[{"width":"100"},{"width":"100"},{"width":"100"},
                 {"width":"100"},{"width":"100"},{"width":"100"}]'::jsonb
 where id='00000000-0000-0000-0000-0000000000bb';
select public.ensure_job_loading('00000000-0000-0000-0000-0000000000aa');
insert into t values (8, 'אחרי שינוי רוחב — הכמות',
  (select qty from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design'
    order by sort limit 1), '100 ס״מ');

-- 6. מחיקת הקיר — ניקוי שורות יתומות
delete from public.koolisot where id='00000000-0000-0000-0000-0000000000bb';
insert into t values (9, 'ניקוי יתומים — שורות שנמחקו',
  public.clean_job_loading('00000000-0000-0000-0000-0000000000aa')::text, '6');
insert into t values (10, 'אחרי ניקוי — שורות קוליסות',
  (select count(*)::text from public.job_loading
    where job_id='00000000-0000-0000-0000-0000000000aa' and source='design'), '0');

select n as "#", step as "שלב", got as "יצא", want as "צפוי",
       case when got is not distinct from want then '✓' else '✗ נכשל' end as "תוצאה"
  from t order by n;

rollback;
