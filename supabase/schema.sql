-- ============================================================
-- שילה — הקמת מסד נתונים. הדבק והרץ ב-Supabase → SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title      text,
  client     text,
  contact    text,
  event_date date,
  status     text default 'inquiry',
  price      integer default 0,
  items      jsonb default '[]'::jsonb,
  team       jsonb default '[]'::jsonb,
  note       text
);

-- אבטחה: רק משתמשים מחוברים ניגשים לנתונים
alter table public.jobs enable row level security;

drop policy if exists "staff read"   on public.jobs;
drop policy if exists "staff insert" on public.jobs;
drop policy if exists "staff update" on public.jobs;
drop policy if exists "staff delete" on public.jobs;

create policy "staff read"   on public.jobs for select to authenticated using (true);
create policy "staff insert" on public.jobs for insert to authenticated with check (true);
create policy "staff update" on public.jobs for update to authenticated using (true) with check (true);
create policy "staff delete" on public.jobs for delete to authenticated using (true);

-- נתוני דמו (תאריכים יחסית להיום — אפשר למחוק בהמשך)
insert into public.jobs (title, client, contact, event_date, status, price, items, team, note) values
  ('בר מצווה — אולם הגן', 'משפחת לוי', '052-4418290', current_date + 2, 'production', 4200, '[{"cat":"backdrop","name":"קוליסת כניסה 3×2.4מ׳","qty":1,"price":2200},{"cat":"sign","name":"שלט כאפות \"אורי\" — גדול","qty":1,"price":1400},{"cat":"carpet","name":"שטיח כניסה אדום","qty":1,"price":600}]'::jsonb, '["רן","מאור"]'::jsonb, 'התקנה יום לפני, 08:00'),
  ('כנס חברה — במה ראשית', 'אולמי הדר', '03-5567120', current_date + 5, 'approval', 7800, '[{"cat":"backdrop","name":"קוליסת במה 6×3מ׳ ממותגת","qty":1,"price":5200},{"cat":"print","name":"רולאפים ממותגים","qty":4,"price":1600},{"cat":"carpet","name":"שטיח שחור מקצועי","qty":2,"price":1000}]'::jsonb, '[]'::jsonb, 'ממתין לאישור מקדמה'),
  ('חתונה — גן האירועים', 'טליה כהן', '054-8830021', current_date + 9, 'design', 8900, '[{"cat":"sign","name":"שלט כאפות \"T ♥ D\" — ענק","qty":1,"price":3800},{"cat":"backdrop","name":"קיר פרחים 4×2.4מ׳","qty":1,"price":4200},{"cat":"carpet","name":"שטיח לבן חופה","qty":1,"price":900}]'::jsonb, '[]'::jsonb, 'סקיצה ראשונה נשלחה'),
  ('ערב התרמה', 'עמותת יד־ביד', '050-2214477', current_date + -1, 'installed', 3100, '[{"cat":"backdrop","name":"קוליסת צילום 3×2.4מ׳","qty":1,"price":2200},{"cat":"print","name":"פוסטרים A1","qty":6,"price":900}]'::jsonb, '["רן"]'::jsonb, 'הוחזר למחסן'),
  ('ברית — בית פרטי', 'משפחת אזולאי', '052-9014410', current_date + 1, 'ready', 1900, '[{"cat":"sign","name":"שלט כאפות \"יוסף\" — בינוני","qty":1,"price":1200},{"cat":"carpet","name":"שטיח כניסה כחול","qty":1,"price":700}]'::jsonb, '["מאור"]'::jsonb, 'ארוז ומוכן לאיסוף'),
  ('השקת מוצר', 'חברת נובה', '073-2299010', current_date + 14, 'inquiry', 0, '[]'::jsonb, '[]'::jsonb, 'פנייה טלפונית — לחזור עם הצעה'),
  ('בת מצווה — גג עירוני', 'משפחת פרץ', '053-7781234', current_date + 3, 'production', 5400, '[{"cat":"sign","name":"שלט כאפות \"נועה\" — גדול","qty":1,"price":1400},{"cat":"backdrop","name":"קוליסת ניאון מותאמת","qty":1,"price":3200},{"cat":"carpet","name":"שטיח ורוד","qty":1,"price":800}]'::jsonb, '["רן","מאור","שיר"]'::jsonb, 'ניאון בייצור אצל ספק'),
  ('כנס רפואי', 'מלון סברינה', '04-6612000', current_date + 21, 'approval', 6200, '[{"cat":"backdrop","name":"קיר לוגואים 5×2.4מ׳","qty":1,"price":4400},{"cat":"print","name":"שילוט כיווני","qty":8,"price":1800}]'::jsonb, '[]'::jsonb, 'ממתין לחתימת הסכם'),
  ('אירוסין — חצר', 'דנה ואורן', '058-4433221', current_date + 7, 'design', 2550, '[{"cat":"sign","name":"שלט כאפות \"לב\" — בינוני","qty":2,"price":1800},{"cat":"carpet","name":"שטיח שמפניה","qty":1,"price":750}]'::jsonb, '[]'::jsonb, ''),
  ('טקס יום העצמאות', 'עיריית רמת־גן', '03-6720000', current_date + -3, 'installed', 12400, '[{"cat":"backdrop","name":"במה מרכזית 8×4מ׳","qty":1,"price":8800},{"cat":"print","name":"דגלים ושילוט","qty":20,"price":3600}]'::jsonb, '["רן","מאור","שיר"]'::jsonb, 'הסתיים בהצלחה');
