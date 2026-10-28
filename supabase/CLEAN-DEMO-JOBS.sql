-- ============================================================
-- שילה — ניקוי נתוני הדמו, בלי לגעת בצוות.
--
-- ⚠️ פעולה בלתי הפיכה.
--
-- מוחק: עבודות (וגורר משמרות, הודעות, קבצים, רשימות העמסה
--        והתראות), קוליסות, מפיקות, וכל ההתראות שנשארו.
--
-- נשמר: העובדים והקישור שלהם לחשבון — שי ובן, כולל ☑ מנהל.
--        המלאי. ערכת ההעמסה (מברגה, ברגים, אקדח סיכות).
--
-- זו ההבדל מ-CLEAN-DEMO.sql, שמוחק גם את טבלת העובדים ומשאיר
-- את בן עם חשבון התחברות בלי כרטיס עובד ובלי הרשאות.
-- ============================================================

begin;

-- עבודות — גורר משמרות, הודעות, קבצים, job_loading והתראות
delete from public.jobs where id is not null;

-- קוליסות מתנתקות ממחיקת עבודה ולא נמחקות איתה
delete from public.koolisot where id is not null;

-- מפיקות והקישורים שלהן
delete from public.clients where id is not null;

-- התראות שלא נגררו (כאלה בלי job_id)
delete from public.notifications where id is not null;

-- מספור ההזמנות מתחיל מחדש: העבודה הראשונה של שי תהיה #1001
alter sequence public.job_order_seq restart with 1001;

commit;

-- מה נשאר
select 'עבודות'        as טבלה, count(*) from public.jobs
union all select 'משמרות',        count(*) from public.shifts
union all select 'קוליסות',       count(*) from public.koolisot
union all select 'מפיקות',        count(*) from public.clients
union all select 'התראות',        count(*) from public.notifications
union all select 'רשימות העמסה',  count(*) from public.job_loading
union all select 'עובדים (נשמר)', count(*) from public.employees
union all select 'מנהלים (נשמר)', count(*) from public.employees where is_manager
union all select 'מלאי (נשמר)',   count(*) from public.inventory
union all select 'ערכה (נשמר)',   count(*) from public.loading_defaults;
