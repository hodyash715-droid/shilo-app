-- ============================================================
-- רשימת העמסה לעבודה, עם צ'קליסט לעובד המשובץ.
--
-- שלושה מקורות לפריט:
--   kit    — ערכה קבועה שתמיד עולה על האוטו (מברגה, ברגים,
--            אקדח סיכות). נערכת פעם אחת בהגדרות, לא לכל עבודה.
--   design — מה שתוכנן במעצב: קוליסות וקירות ששויכו לעבודה.
--   manual — מה ששי מוסיף לעבודה הזו בלבד (תרנים, אלמניה,
--            חולץ בזנטים, בזנטים).
--
-- הכמות היא *טקסט* ולא מספר בכוונה: "2", "קופסה", "לפי הצורך".
-- מספר היה מכריח להמציא יחידה לכל דבר.
--
-- בטוח להרצה חוזרת.
-- ============================================================

-- ---------- הערכה הקבועה ----------
create table if not exists public.loading_defaults (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  label      text not null,
  qty        text,
  sort       integer default 0,
  active     boolean not null default true
);

-- ---------- רשימת ההעמסה של עבודה ----------
create table if not exists public.job_loading (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  job_id     uuid references public.jobs(id) on delete cascade,
  label      text not null,
  qty        text,
  source     text not null default 'manual',   -- kit | design | manual
  sort       integer default 0,
  done       boolean not null default false,
  done_by    uuid,                             -- employees.id
  done_at    timestamptz
);
create index if not exists job_loading_job_idx on public.job_loading (job_id);

-- ---------- האם אני משובץ לעבודה הזו ----------
create or replace function public.my_job(p_job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shifts s
     where s.job_id = p_job
       and s.assigned ? public.my_employee_id()::text
  )
$$;

-- ---------- סימון פריט ----------
-- דרך פונקציה ולא דרך update ישיר: RLS לא יודעת להגביל *עמודות*,
-- ולכן הרשאת כתיבה ישירה לעובד הייתה מאפשרת לו גם לשנות שמות
-- וכמויות. כאן הוא יכול רק לסמן.
create or replace function public.set_loading_done(p_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_job uuid;
begin
  select job_id into v_job from public.job_loading where id = p_id;
  if v_job is null then raise exception 'item not found'; end if;
  if not (public.is_manager() or public.my_job(v_job)) then
    raise exception 'not allowed';
  end if;
  update public.job_loading
     set done    = p_done,
         done_by = case when p_done then public.my_employee_id() else null end,
         done_at = case when p_done then now() else null end
   where id = p_id;
end $$;

-- ---------- זריעת הערכה הקבועה ----------
-- נקראת כשפותחים את רשימת ההעמסה בפעם הראשונה. מוסיפה רק את מה
-- שחסר, ולכן אפשר לקרוא לה שוב בלי ליצור כפילויות.
create or replace function public.ensure_job_loading(p_job uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_added integer := 0;
begin
  if not (public.is_manager() or public.my_job(p_job)) then
    raise exception 'not allowed';
  end if;
  insert into public.job_loading (job_id, label, qty, source, sort)
  select p_job, d.label, d.qty, 'kit', d.sort
    from public.loading_defaults d
   where d.active
     and not exists (
       select 1 from public.job_loading l
        where l.job_id = p_job and l.source = 'kit' and l.label = d.label
     );
  get diagnostics v_added = row_count;
  return v_added;
end $$;

-- ---------- הרשאות ----------
alter table public.loading_defaults enable row level security;
alter table public.job_loading      enable row level security;

drop policy if exists "ld manager all" on public.loading_defaults;
drop policy if exists "ld read"        on public.loading_defaults;
create policy "ld manager all" on public.loading_defaults for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "ld read" on public.loading_defaults for select to authenticated
  using (true);

drop policy if exists "jl manager all" on public.job_loading;
drop policy if exists "jl worker read" on public.job_loading;
create policy "jl manager all" on public.job_loading for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
-- העובד רואה רק את רשימות העבודות שהוא משובץ אליהן, ומסמן דרך
-- set_loading_done בלבד.
create policy "jl worker read" on public.job_loading for select to authenticated
  using (public.my_job(job_id));

grant execute on function public.my_job(uuid)                     to authenticated;
grant execute on function public.set_loading_done(uuid, boolean)  to authenticated;
grant execute on function public.ensure_job_loading(uuid)         to authenticated;

-- ---------- ערכת פתיחה ----------
-- שלושת אלה נמסרו כ"תמיד". שי יוכל להוסיף ולערוך מההגדרות.
insert into public.loading_defaults (label, qty, sort)
select v.label, v.qty, v.sort
  from (values
    ('מברגה',      '1', 10),
    ('ברגים',      'קופסה', 20),
    ('אקדח סיכות', '1', 30)
  ) as v(label, qty, sort)
 where not exists (select 1 from public.loading_defaults d where d.label = v.label);
