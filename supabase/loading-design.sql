-- ============================================================
-- רשימת העמסה: הקוליסות נכנסות לבד, מקובצות תחת הקיר שהן מרכיבות.
--
-- עד כאן שי היה צריך ללחוץ "הוסף מהעיצוב", והעובד לא ראה כלום עד
-- שלחץ. מעכשיו ensure_job_loading זורעת גם את העיצוב, ולכן כל עובד
-- שמשובץ לעבודה רואה את הקוליסות ברגע שהוא פותח את הרשימה.
--
-- למה בצד השרת ולא בדפדפן: על koolisot יש מדיניות "מנהל בלבד",
-- ועובד לא יכול לקרוא את הטבלה הזו. הפונקציה היא security definer,
-- ולכן היא קוראת את התכנון בשבילו בלי לפתוח לו את הטבלה.
--
-- קיר נשבר לשורה לכל קוליסה, כי מעמיסים קוליסה-קוליסה על האוטו.
-- grp הוא שם הקיר, ולכן בטלפון רואים "קיר במה ראשית" ומתחתיו
-- ארבע שורות לסמן.
--
-- בטוח להרצה חוזרת. דורש שכבר הורץ loading.sql.
-- ============================================================

-- grp   — הכותרת שמעל השורה (שם הקיר). ריק = לפי המקור.
-- ref_id — הרשומה בתכנון שממנה השורה נזרעה. בלעדיה זריעה חוזרת
--          הייתה מכפילה את אותן קוליסות בכל פתיחה.
alter table public.job_loading add column if not exists grp    text;
alter table public.job_loading add column if not exists ref_id uuid;

create index if not exists job_loading_ref_idx on public.job_loading (job_id, ref_id);

create or replace function public.ensure_job_loading(p_job uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_added integer := 0;
  v_n     integer;
  v_i     integer;
  v_w     jsonb;
  v_arr   jsonb;
  v_qty   text;
  k       record;
begin
  if not (public.is_manager() or public.my_job(p_job)) then
    raise exception 'not allowed';
  end if;

  -- ---------- הערכה הקבועה ----------
  insert into public.job_loading (job_id, label, qty, source, sort)
  select p_job, d.label, d.qty, 'kit', d.sort
    from public.loading_defaults d
   where d.active
     and not exists (
       select 1 from public.job_loading l
        where l.job_id = p_job and l.source = 'kit' and l.label = d.label
     );
  get diagnostics v_added = row_count;

  -- ---------- מהתכנון ----------
  for k in select * from public.koolisot where job_id = p_job order by created_at
  loop
    -- כבר נזרעה פעם קודמת
    continue when exists (
      select 1 from public.job_loading l
       where l.job_id = p_job and l.ref_id = k.id
    );

    -- איפה יושבות הקוליסות, לפי סוג הרשומה
    if k.preview->>'kind' = 'wall-layout' then
      v_arr := k.preview->'wall'->'widths';     -- קיר מסודר: parts הם החלקים
    elsif k.preview->>'kind' = 'wall' then
      v_arr := k.parts;                          -- קיר: parts הם הקוליסות
    else
      v_arr := null;                             -- קוליסה בודדת
    end if;

    if v_arr is null or jsonb_typeof(v_arr) <> 'array' or jsonb_array_length(v_arr) = 0 then
      insert into public.job_loading (job_id, label, qty, source, sort, grp, ref_id)
      values (p_job, k.name,
              nullif(concat_ws('×', k.preview->>'גובה', k.preview->>'רוחב'), ''),
              'design', 200, 'קוליסות בודדות', k.id);
      v_added := v_added + 1;
    else
      v_n := jsonb_array_length(v_arr);
      for v_i in 0 .. v_n - 1 loop
        v_w := v_arr -> v_i;
        -- רוחב הקוליסה הוא מספר או אובייקט {width,height} — שתי הצורות קיימות
        v_qty := case jsonb_typeof(v_w)
                   when 'number' then v_w #>> '{}'
                   when 'object' then v_w->>'width'
                   else null end;
        insert into public.job_loading (job_id, label, qty, source, sort, grp, ref_id)
        values (p_job,
                format('קוליסה %s מתוך %s', v_i + 1, v_n),
                case when v_qty is null then null else v_qty || ' ס״מ' end,
                'design', 200 + v_i, k.name, k.id);
        v_added := v_added + 1;
      end loop;
    end if;
  end loop;

  return v_added;
end $$;

grant execute on function public.ensure_job_loading(uuid) to authenticated;

-- ---------- בדיקה ----------
-- מה ייזרע לעבודה מסוימת:
--   select grp, label, qty, source from public.job_loading
--    where job_id = '<id>' order by source, sort;
