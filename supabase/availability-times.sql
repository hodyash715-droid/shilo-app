-- ============================================================
-- שילה — הוספת טווח שעות מותאם לזמינות.
-- מוסיף שתי עמודות לטבלה קיימת. בטוח להרצה חוזרת.
-- ============================================================

alter table public.availability add column if not exists start_time text;
alter table public.availability add column if not exists end_time   text;
