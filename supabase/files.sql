-- ============================================================
-- שילה — קבצים על הזמנה (לוגו, מיתוג, סקיצות).
-- הרץ אחרי messages.sql. בטוח להרצה חוזרת.
-- ============================================================

-- דלי פרטי. אין גישה ציבורית — הצפייה היא בקישורים חתומים בלבד.
insert into storage.buckets (id, name, public, file_size_limit)
values ('job-files', 'job-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create table if not exists public.job_files (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  from_client boolean not null default false,
  author      text,
  path        text not null,      -- הנתיב בתוך הדלי
  name        text not null,      -- שם הקובץ המקורי
  size        integer,
  mime        text
);

create index if not exists jf_job_idx on public.job_files (job_id, created_at);

alter table public.job_files enable row level security;

drop policy if exists "jf manager all" on public.job_files;
create policy "jf manager all" on public.job_files for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ---------- הרשאות אחסון: שי בלבד ניגש ישירות ----------
drop policy if exists "jfs manager read"   on storage.objects;
drop policy if exists "jfs manager insert" on storage.objects;
drop policy if exists "jfs manager delete" on storage.objects;

create policy "jfs manager read" on storage.objects for select to authenticated
  using (bucket_id = 'job-files' and public.is_manager());
create policy "jfs manager insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-files' and public.is_manager());
create policy "jfs manager delete" on storage.objects for delete to authenticated
  using (bucket_id = 'job-files' and public.is_manager());

-- ---------- אימות שההזמנה שייכת לבעל הטוקן ----------
-- נקראת רק מהפונקציה בשרת (service_role).
create or replace function public.client_job_owner(p_token text, p_job uuid)
returns table (ok boolean, client_name text, job_title text)
language sql stable security definer set search_path = public as $$
  select true, c.name, j.title
    from public.clients c
    join public.jobs j on j.client_id = c.id
   where c.token = p_token and c.active and j.id = p_job
$$;

revoke all on function public.client_job_owner(text, uuid) from public, anon, authenticated;

-- ---------- התראה לשי כשהמפיקה מצרפת קובץ ----------
create or replace function public.notify_client_file()
returns trigger language plpgsql security definer set search_path = public as $$
declare j record;
begin
  if not new.from_client then return new; end if;
  select title into j from public.jobs where id = new.job_id;
  insert into public.notifications (kind, title, body, job_id, audience)
  values ('order', 'קובץ חדש מ' || coalesce(new.author, 'הלקוח'),
          coalesce(j.title, 'עבודה') || ' · ' || new.name, new.job_id, 'manager');
  return new;
end $$;

drop trigger if exists job_files_notify on public.job_files;
create trigger job_files_notify after insert on public.job_files
  for each row execute function public.notify_client_file();
