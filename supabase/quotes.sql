-- ============================================================
-- שילה — ציר הצעת המחיר (נפרד מציר העבודה).
-- בטוח להרצה חוזרת.
-- ============================================================

-- none = הזמנה שנוצרה ידנית ואין בה צורך בהצעה
-- needs_quote = התקבלה הזמנה, יש לשלוח הצעת מחיר
-- sent = ההצעה נשלחה, ממתינים לאישור הלקוח
-- approved = הלקוח אישר
-- rejected = הלקוח דחה
alter table public.jobs add column if not exists quote_status text default 'none';
alter table public.jobs add column if not exists quote_sent_at     timestamptz;
alter table public.jobs add column if not exists quote_decided_at  timestamptz;
