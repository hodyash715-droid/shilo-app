-- ============================================================
-- חזרה למחסן: העובד עובר על הרשימה ומסמן מה חזר, ושי מקבל דיווח.
--
-- שתי עמודות סימון נפרדות על אותה שורה:
--   done     — הועמס על האוטו ביציאה
--   returned — חזר למחסן בסוף
-- בכוונה נפרדות. אם היה דגל אחד, סימון החזרה היה מוחק את תיעוד
-- ההעמסה, ואי אפשר היה לדעת אם פריט חסר כי לא נלקח או כי אבד.
--
-- הדיווח נכנס ל-notifications כשתי צורות:
--   return_ok      — הכל חזר (ירוק אצל שי)
--   return_missing — חסר, עם רשימת מה שחסר (אדום)
-- ההתראה נכתבת מתוך security definer, כי על notifications יש
-- מדיניות "מנהל בלבד" לכתיבה — העובד לא יכול לכתוב לשי ישירות.
--
-- בטוח להרצה חוזרת. דורש loading.sql ו-loading-design.sql.
-- ============================================================

alter table public.job_loading add column if not exists returned    boolean not null default false;
alter table public.job_loading add column if not exists returned_by uuid;
alter table public.job_loading add column if not exists returned_at timestamptz;

-- ---------- סימון חזרה, פריט אחד ----------
create or replace function public.set_loading_returned(p_id uuid, p_returned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_job uuid;
begin
  select job_id into v_job from public.job_loading where id = p_id;
  if v_job is null then raise exception 'item not found'; end if;
  if not (public.is_manager() or public.my_job(v_job)) then
    raise exception 'not allowed';
  end if;
  update public.job_loading
     set returned    = p_returned,
         returned_by = case when p_returned then public.my_employee_id() else null end,
         returned_at = case when p_returned then now() else null end
   where id = p_id;
end $$;

-- ---------- "הכל חזר" ----------
-- מסמן את כל שורות העבודה בבת אחת, ומחזיר כמה שורות השתנו.
create or replace function public.set_all_loading_returned(p_job uuid, p_returned boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not (public.is_manager() or public.my_job(p_job)) then
    raise exception 'not allowed';
  end if;
  update public.job_loading
     set returned    = p_returned,
         returned_by = case when p_returned then public.my_employee_id() else null end,
         returned_at = case when p_returned then now() else null end
   where job_id = p_job and returned is distinct from p_returned;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------- דיווח לשי ----------
-- מחזיר { total, missing, list } כדי שהעובד יראה מיד מה דיווח,
-- ובמקביל כותב התראה לשי.
create or replace function public.report_loading_return(p_job uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total   integer;
  v_missing integer;
  v_list    text;
  v_extra   integer;
  v_title   text;
  v_who     text;
begin
  if not (public.is_manager() or public.my_job(p_job)) then
    raise exception 'not allowed';
  end if;

  select count(*), count(*) filter (where not returned)
    into v_total, v_missing
    from public.job_loading where job_id = p_job;

  if v_total = 0 then
    raise exception 'empty list';
  end if;

  select title into v_title from public.jobs where id = p_job;
  select name  into v_who   from public.employees where id = public.my_employee_id();

  -- רשימה ארוכה לא נכנסת לשורת התראה. שמונה ראשונים ואז "ועוד N".
  select string_agg(txt, ', ')
    into v_list
    from (
      select coalesce(grp || ' · ', '') || label as txt
        from public.job_loading
       where job_id = p_job and not returned
       order by sort, created_at
       limit 8
    ) t;
  v_extra := greatest(0, v_missing - 8);
  if v_extra > 0 then v_list := v_list || format(' ועוד %s', v_extra); end if;

  if v_missing = 0 then
    insert into public.notifications (kind, title, body, job_id, audience)
    values ('return_ok',
            'הכל חזר למחסן',
            coalesce(v_title, 'עבודה')
              || format(' · %s פריטים', v_total)
              || coalesce(' · ' || v_who, ''),
            p_job, 'manager');
  else
    insert into public.notifications (kind, title, body, job_id, audience)
    values ('return_missing',
            format('%s מתוך %s לא חזרו', v_missing, v_total),
            coalesce(v_title, 'עבודה') || ' · ' || coalesce(v_list, '')
              || coalesce(' · ' || v_who, ''),
            p_job, 'manager');
  end if;

  return jsonb_build_object('total', v_total, 'missing', v_missing, 'list', v_list);
end $$;

grant execute on function public.set_loading_returned(uuid, boolean)     to authenticated;
grant execute on function public.set_all_loading_returned(uuid, boolean) to authenticated;
grant execute on function public.report_loading_return(uuid)             to authenticated;
