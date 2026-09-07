-- ============================================================
-- שילה — ניקוי נתוני הדמו לקראת מסירה לשי.
--
-- ⚠️ פעולה בלתי הפיכה. מוחק עבודות, עובדים ומפיקות.
-- שחזור: הרצה חוזרת של ה-INSERT בסוף schema.sql / employees.sql.
--
-- נשמר: המלאי (14 פריטים), החשבון של שי, וכל המבנה.
-- ============================================================

begin;

-- עבודות — גורר איתו משמרות, הודעות, קבצים והתראות
delete from public.jobs where id is not null;

-- קוליסות (מתנתקות ממחיקת עבודה, לא נמחקות)
delete from public.koolisot where id is not null;

-- מפיקות והקישורים שלהן
delete from public.clients where id is not null;

-- עובדים — גורר זמינות ומנויי Push
delete from public.employees where id is not null;

-- מכשירי Push של הבדיקות
delete from public.push_subs where id is not null;

-- יומן ניסיונות ההצטרפות
delete from public.join_attempts where user_id is not null;

-- מספור ההזמנות מתחיל מחדש: העבודה הראשונה של שי תהיה #1001
alter sequence public.job_order_seq restart with 1001;

commit;

-- מה נשאר
select 'עבודות' as טבלה, count(*) from public.jobs
union all select 'עובדים', count(*) from public.employees
union all select 'מפיקות', count(*) from public.clients
union all select 'משמרות', count(*) from public.shifts
union all select 'קוליסות', count(*) from public.koolisot
union all select 'התראות', count(*) from public.notifications
union all select 'מלאי (נשמר)', count(*) from public.inventory;
