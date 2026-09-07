-- ============================================================
-- שילה — הידוק קוד ההצטרפות.
-- קוד בן 6 תווים hex (16.7M) ניתן לניחוש בכוח, ולא היה מוגבל
-- בניסיונות ולא פג. שלוש שכבות: קוד ארוך, תפוגה, וחסימת ניסיונות.
-- בטוח להרצה חוזרת.
-- ============================================================

alter table public.employees add column if not exists join_expires_at timestamptz;

-- ---------- יומן ניסיונות, לחסימת ניחוש בכוח ----------
create table if not exists public.join_attempts (
  user_id    uuid not null,
  tried_at   timestamptz not null default now(),
  ok         boolean not null default false
);
create index if not exists ja_user_idx on public.join_attempts (user_id, tried_at desc);

alter table public.join_attempts enable row level security;
-- אף לקוח לא ניגש לזה ישירות; רק הפונקציה בשרת
drop policy if exists "ja none" on public.join_attempts;

-- ---------- מחולל קוד: 8 תווים, ללא תווים מתבלבלים ----------
-- 0/O/1/I/L הוסרו כדי שאפשר יהיה להכתיב בטלפון בלי טעויות.
create or replace function public.gen_join_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   -- 31 תווים
  out text := '';
  i int;
begin
  for i in 1..8 loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end $$;

-- ---------- תפיסת קוד, מוגנת ----------
create or replace function public.claim_employee_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_fails int;
  v_uid   uuid := auth.uid();
begin
  if v_uid is null then return null; end if;

  -- עד 10 ניסיונות כושלים ביממה. אחרי זה חסום, גם עם הקוד הנכון.
  select count(*) into v_fails
    from public.join_attempts
   where user_id = v_uid and not ok and tried_at > now() - interval '24 hours';
  if v_fails >= 10 then
    raise exception 'too many attempts';
  end if;

  -- כבר מקושר לקוד הזה? מחזירים בלי לרשום ניסיון
  select id into v_id from public.employees
   where join_code = upper(btrim(p_code)) and user_id = v_uid;
  if v_id is not null then return v_id; end if;

  update public.employees
     set user_id = v_uid,
         join_code = null,              -- קוד נשרף אחרי שימוש
         join_expires_at = null
   where join_code = upper(btrim(p_code))
     and user_id is null
     and (join_expires_at is null or join_expires_at > now())
   returning id into v_id;

  insert into public.join_attempts (user_id, ok) values (v_uid, v_id is not null);
  return v_id;
end $$;

grant execute on function public.claim_employee_code(text) to authenticated;
grant execute on function public.gen_join_code() to authenticated;

-- ---------- הנפקת קודים חדשים וחזקים לעובדים שטרם הצטרפו ----------
update public.employees
   set join_code = public.gen_join_code(),
       join_expires_at = now() + interval '14 days'
 where user_id is null;

-- מי שכבר מקושר לא צריך קוד תלוי באוויר
update public.employees
   set join_code = null, join_expires_at = null
 where user_id is not null;

-- ============================================================
-- נעילת הרשאות ריצה.
-- Postgres מעניק EXECUTE ל-PUBLIC אוטומטית בכל create function,
-- ולכן claim_employee_code היה פתוח גם ל-anon: אפשר היה לבדוק
-- קוד הצטרפות בלי חשבון בכלל ולקבל תשובה חד-משמעית.
-- ============================================================

revoke execute on function public.claim_employee_code(text) from public, anon;
revoke execute on function public.my_job_titles()           from public, anon;
revoke execute on function public.gen_join_code()           from public, anon;
revoke execute on function public.is_manager()              from public, anon;
revoke execute on function public.my_employee_id()          from public, anon;

grant execute on function public.claim_employee_code(text) to authenticated;
grant execute on function public.my_job_titles()           to authenticated;

-- הפונקציות של דף הלקוח נשארות פתוחות ל-anon בכוונה:
-- המפיקה אינה מחוברת, וההגנה היא הטוקן שנבדק בתוכן.
grant execute on function public.client_portal(text)                          to anon, authenticated;
grant execute on function public.client_submit_order(text,text,date,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.client_decide_quote(text,uuid,boolean,text)  to anon, authenticated;
grant execute on function public.client_post_message(text,uuid,text,text)     to anon, authenticated;
