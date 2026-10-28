-- ============================================================
-- סנכרון רשימת ההעמסה אחרי שינוי בתכנון.
--
-- הבאג: ensure_job_loading דילגה על כל קיר שכבר נזרע (ref_id קיים),
-- ולכן שינוי באולפן לא הגיע לעובד. שי מרחיב קיר מ-4 ל-6 קוליסות,
-- והעובד עדיין רואה 4 — מעמיס 4, ומגיע לאולם עם שתי קוליסות חסרות.
--
-- הפתרון: טביעת אצבע לכל קיר — שם הקבוצה, ואחריה שורה לכל קוליסה
-- בצורה "תווית|כמות". אם היא זהה למה שכבר ברשימה, אין מה לעשות.
-- אם היא שונה — הקיר נזרע מחדש.
--
-- זה תופס שלושה שינויים, לא רק אחד:
--   · מספר הקוליסות השתנה
--   · רוחב של קוליסה השתנה
--   · הקיר שונה שם
--
-- הסימונים לא הולכים לאיבוד: done ו-returned נשמרים לפי המיקום,
-- כך שקוליסה שכבר סומנה נשארת מסומנת. קוליסה שנוספה מתחילה ריקה.
--
-- בטוח להרצה חוזרת. דורש loading.sql ו-loading-design.sql.
-- ============================================================

create or replace function public.ensure_job_loading(p_job uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_added integer := 0;
  v_n     integer;
  v_i     integer;
  v_w     jsonb;
  v_arr   jsonb;
  v_grp     text;   -- הקבוצה הרצויה
  v_grp_old text;   -- הקבוצה שכבר רשומה
  v_want  text[];      -- טביעת האצבע הרצויה
  v_cur   text[];      -- מה שכבר ברשימה
  v_labels text[];
  v_qtys   text[];
  v_done  boolean[];
  v_ret   boolean[];
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
    -- איפה יושבות הקוליסות, לפי סוג הרשומה
    if k.preview->>'kind' = 'wall-layout' then
      v_arr := k.preview->'wall'->'widths';     -- קיר מסודר: parts הם החלקים
    elsif k.preview->>'kind' = 'wall' then
      v_arr := k.parts;                          -- קיר: parts הם הקוליסות
    else
      v_arr := null;                             -- קוליסה בודדת
    end if;

    v_labels := '{}'; v_qtys := '{}';

    if v_arr is null or jsonb_typeof(v_arr) <> 'array' or jsonb_array_length(v_arr) = 0 then
      v_grp    := 'קוליסות בודדות';
      v_labels := array[k.name];
      v_qtys   := array[coalesce(nullif(concat_ws('×', k.preview->>'גובה', k.preview->>'רוחב'), ''), '')];
    else
      v_grp := k.name;
      v_n   := jsonb_array_length(v_arr);
      for v_i in 0 .. v_n - 1 loop
        v_w := v_arr -> v_i;
        -- רוחב הקוליסה הוא מספר או אובייקט {width,height} — שתי הצורות קיימות
        v_labels := v_labels || format('קוליסה %s מתוך %s', v_i + 1, v_n);
        v_qtys   := v_qtys || coalesce(
          case jsonb_typeof(v_w)
            when 'number' then (v_w #>> '{}') || ' ס״מ'
            when 'object' then (v_w->>'width') || ' ס״מ'
            else null end, '');
      end loop;
    end if;

    -- טביעת האצבע הרצויה: קבוצה, ואז "תווית|כמות" לכל שורה
    v_want := array[v_grp];
    for v_i in 1 .. array_length(v_labels, 1) loop
      v_want := v_want || (v_labels[v_i] || '|' || v_qtys[v_i]);
    end loop;

    -- מה שכבר ברשימה לקיר הזה, ובאותו סדר
    select coalesce(min(grp), '')
      into v_grp_old
      from public.job_loading where job_id = p_job and ref_id = k.id;
    select coalesce(array_agg(label || '|' || coalesce(qty, '') order by sort, created_at), '{}'),
           coalesce(array_agg(done     order by sort, created_at), '{}'),
           coalesce(array_agg(returned order by sort, created_at), '{}')
      into v_cur, v_done, v_ret
      from public.job_loading where job_id = p_job and ref_id = k.id;
    v_cur := array[v_grp_old] || v_cur;

    continue when v_cur = v_want;   -- התכנון לא השתנה

    -- נזרע מחדש. הסימונים נשמרים לפי מיקום, כדי שמה שכבר הועמס
    -- או חזר לא יתאפס בגלל שהקיר גדל.
    delete from public.job_loading where job_id = p_job and ref_id = k.id;

    for v_i in 1 .. array_length(v_labels, 1) loop
      insert into public.job_loading
        (job_id, label, qty, source, sort, grp, ref_id, done, returned)
      values
        (p_job, v_labels[v_i], nullif(v_qtys[v_i], ''), 'design', 199 + v_i,
         v_grp, k.id,
         coalesce(v_done[v_i], false), coalesce(v_ret[v_i], false));
      v_added := v_added + 1;
    end loop;
  end loop;

  return v_added;
end $$;

grant execute on function public.ensure_job_loading(uuid) to authenticated;

-- ---------- ניקוי שורות יתומות ----------
-- קיר שנמחק מהתכנון השאיר את הקוליסות שלו ברשימה לנצח. אין מפתח
-- זר על ref_id (הוא מצביע על טבלה שהעובד לא רשאי לקרוא), ולכן
-- הניקוי נעשה כאן, בכל פתיחה של רשימה.
create or replace function public.clean_job_loading(p_job uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not (public.is_manager() or public.my_job(p_job)) then
    raise exception 'not allowed';
  end if;
  delete from public.job_loading l
   where l.job_id = p_job
     and l.ref_id is not null
     and not exists (select 1 from public.koolisot k where k.id = l.ref_id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.clean_job_loading(uuid) to authenticated;
