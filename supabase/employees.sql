-- ============================================================
-- שילה — טבלת עובדים. הדבק והרץ ב-Supabase → SQL Editor.
-- ============================================================

create table if not exists public.employees (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text not null,
  role       text,            -- מתקין / נהג / אחראי אתר ...
  phone      text,
  rate       integer,         -- שכר לשעה (₪)
  active     boolean default true
);

alter table public.employees enable row level security;

drop policy if exists "emp read"   on public.employees;
drop policy if exists "emp insert" on public.employees;
drop policy if exists "emp update" on public.employees;
drop policy if exists "emp delete" on public.employees;

create policy "emp read"   on public.employees for select to authenticated using (true);
create policy "emp insert" on public.employees for insert to authenticated with check (true);
create policy "emp update" on public.employees for update to authenticated using (true) with check (true);
create policy "emp delete" on public.employees for delete to authenticated using (true);

-- צוות דמו (אפשר למחוק/לערוך בהמשך)
insert into public.employees (name, role, phone, rate) values
  ('יוסי כהן',   'מתקין · אחראי אתר', '052-3334444', 65),
  ('דני לוי',    'מתקין',            '052-5556666', 58),
  ('משה אברהם',  'מתקין',            '053-7778888', 55),
  ('אבי שלום',   'אחראי פירוק',       '054-1112222', 62),
  ('רונן דוד',   'נהג',              '050-9998877', 60),
  ('שירה בן דוד','מתקינה',           '058-4443322', 57);
