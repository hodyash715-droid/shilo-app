-- ============================================================
-- איפוס סיסמה לעובד, מתוך כרטיס העובד באפליקציה.
--
-- החשבונות של העובדים הם <קוד>@shilo.app — כתובות שלא קיימות
-- באמת, ולכן "שכחתי סיסמה" במייל לא יכול לעבוד. עד היום עובד
-- ששכח סיסמה נתקע, והדרך היחידה הייתה לעבוד ידנית ב-Supabase.
--
-- עכשיו מנהל פותח את כרטיס העובד ← "איפוס סיסמה" ← מקליד סיסמה
-- חדשה ושולח אותה לעובד. העובד נכנס איתה בשם שלו כרגיל.
--
-- כללים:
--   · רק מנהל (is_manager) יכול לאפס
--   · רק עובד שכבר הצטרף לאפליקציה (יש לו חשבון)
--   · לא מאפסים סיסמה של מנהל אחר — רק של עצמך
--   · סיסמה של 6 תווים לפחות (כמו בהצטרפות)
--
-- הרצה: Supabase ← SQL Editor ← הדבק ← Run. בטוח להריץ שוב ושוב.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.manager_set_password(p_employee uuid, p_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid;
  v_mgr boolean;
begin
  if not public.is_manager() then
    raise exception 'רק מנהל יכול לאפס סיסמה';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'הסיסמה חייבת להיות לפחות 6 תווים';
  end if;

  select user_id, coalesce(is_manager, false) into v_uid, v_mgr
    from public.employees where id = p_employee;
  if v_uid is null then
    raise exception 'העובד עוד לא הצטרף לאפליקציה';
  end if;
  if v_mgr and v_uid <> auth.uid() then
    raise exception 'אי אפשר לאפס סיסמה של מנהל אחר';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_uid;
  return found;
end $$;

revoke execute on function public.manager_set_password(uuid, text) from public, anon;
grant execute on function public.manager_set_password(uuid, text) to authenticated;
