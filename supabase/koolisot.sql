-- ============================================================
-- שילה — קוליסות שמורות (תכנון פרמטרי). בטוח להרצה חוזרת.
-- ============================================================

create table if not exists public.koolisot (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text not null,
  preview    jsonb default '{}'::jsonb,   -- מידות ברירת מחדל: גובה/רוחב/עומק/עובי
  parts      jsonb default '[]'::jsonb,   -- החלקים והנוסחאות
  job_id     uuid                          -- אופציונלי: שויכה לעבודה
);

alter table public.koolisot enable row level security;

drop policy if exists "kl manager all" on public.koolisot;
create policy "kl manager all" on public.koolisot for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- אורך קורה סטנדרטי לאופטימיזציית חיתוך (ס"מ)
alter table public.inventory add column if not exists stock_len integer;
