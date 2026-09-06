-- ============================================================
-- שילה — טבלת מלאי (ציוד רב-פעמי). הרץ ב-Supabase → SQL Editor.
-- ============================================================

create table if not exists public.inventory (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text not null,
  total      integer default 0,   -- כמה יחידות יש בסך הכל
  category   text                 -- backdrop / carpet / sign / print / other
);

alter table public.inventory enable row level security;

drop policy if exists "inv read"   on public.inventory;
drop policy if exists "inv insert" on public.inventory;
drop policy if exists "inv update" on public.inventory;
drop policy if exists "inv delete" on public.inventory;

create policy "inv read"   on public.inventory for select to authenticated using (true);
create policy "inv insert" on public.inventory for insert to authenticated with check (true);
create policy "inv update" on public.inventory for update to authenticated using (true) with check (true);
create policy "inv delete" on public.inventory for delete to authenticated using (true);

-- מלאי דמו. השמות תואמים לפריטים שבעבודות הדמו, כדי שהספירה "בחוץ" תעבוד.
insert into public.inventory (name, total, category) values
  ('קוליסת כניסה 3×2.4מ׳',      6,  'backdrop'),
  ('קוליסת במה 6×3מ׳ ממותגת',   2,  'backdrop'),
  ('קוליסת צילום 3×2.4מ׳',      4,  'backdrop'),
  ('קיר פרחים 4×2.4מ׳',         2,  'backdrop'),
  ('קיר לוגואים 5×2.4מ׳',       2,  'backdrop'),
  ('במה מרכזית 8×4מ׳',          1,  'backdrop'),
  ('שטיח כניסה אדום',           4,  'carpet'),
  ('שטיח כניסה כחול',           3,  'carpet'),
  ('שטיח לבן חופה',             3,  'carpet'),
  ('שטיח שחור מקצועי',          6,  'carpet'),
  ('שטיח ורוד',                 2,  'carpet'),
  ('שטיח שמפניה',               2,  'carpet'),
  ('טראס 3 מ׳',                 8,  'other'),
  ('גב מיתוג 2.5×3 מ׳',         4,  'backdrop');
