-- ============================================================
-- הערכה הקבועה: זיהוי לפי רשומה ולא לפי שם.
--
-- הבאג: שורות הערכה נזרעו לפי השם. שינוי "מברגה" ל"מברגה גדולה"
-- במסך בשטח הוסיף שורה חדשה בכל עבודה שנפתחה מאז, לצד הישנה —
-- אותו כלי מופיע פעמיים ברשימה של העובד.
--
-- הפתרון: ref_id מצביע על loading_defaults, בדיוק כמו ששורת
-- קוליסה מצביעה על koolisot. שם או כמות שהשתנו מתעדכנים במקום.
--
-- ⚠️ שימו לב ל-source: מעכשיו ref_id מצביע על שתי טבלאות שונות —
--    source='kit'    → loading_defaults
--    source='design' → koolisot
--    clean_job_loading מוחקת שורות שהמקור שלהן נעלם, ובלי הסינון
--    לפי source היא הייתה מוחקת את כל שורות הערכה בפתיחה הבאה,
--    כי ה-ref_id שלהן אינו קוליסה.
--
-- שינוי מדיניות מכוון: עד כה שם שהשתנה בערכה לא נגע ברשימות
-- קיימות. מעכשיו כן — אותו פריט, שם מתוקן. הסימונים (done /
-- returned) נשמרים, ולכן שום דבר שהעובד עשה לא הולך לאיבוד.
-- פריט שמכובה או נמחק מהערכה עדיין לא נוגע ברשימות עבר.
--
-- בטוח להרצה חוזרת. דורש loading-resync.sql.
-- ============================================================

-- ---------- קישור שורות ותיקות ----------
-- שורות ערכה שנזרעו לפני השינוי אין להן ref_id. מקשרים לפי השם,
-- פעם אחת, כדי שלא ייחשבו חדשות וייזרעו שוב.
update public.job_loading l
   set ref_id = d.id
  from public.loading_defaults d
 where l.source = 'kit' and l.ref_id is null and l.label = d.label;

-- ---------- ניקוי יתומים, מצומצם לשורות תכנון ----------
create or replace function public.clean_job_loading(p_job uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not (public.is_manager() or public.my_job(p_job)) then
    raise exception 'not allowed';
  end if;
  -- source='design' בלבד: ref_id של שורת ערכה מצביע על
  -- loading_defaults, ובלי התנאי הזה כל הכלים היו נמחקים.
  delete from public.job_loading l
   where l.job_id = p_job
     and l.source = 'design'
     and l.ref_id is not null
     and not exists (select 1 from public.koolisot k where k.id = l.ref_id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.clean_job_loading(uuid) to authenticated;

-- ---------- הזריעה ----------
create or replace function public.ensure_job_loading(p_job uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_added integer := 0;
  v_n     integer;
  v_i     integer;
  v_w     jsonb;
  v_arr   jsonb;
  v_grp     text;
  v_grp_old text;
  v_want  text[];
  v_cur   text[];
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
  -- פריט חדש בערכה נכנס; פריט קיים מזוהה לפי ref_id ולא לפי שם.
  insert into public.job_loading (job_id, label, qty, source, sort, ref_id)
  select p_job, d.label, d.qty, 'kit', d.sort, d.id
    from public.loading_defaults d
   where d.active
     and not exists (
       select 1 from public.job_loading l
        where l.job_id = p_job and l.source = 'kit' and l.ref_id = d.id
     );
  get diagnostics v_added = row_count;

  -- שם או כמות שהשתנו — מתוקנים במקום, בלי לגעת בסימונים
  update public.job_loading l
     set label = d.label, qty = d.qty
    from public.loading_defaults d
   where l.job_id = p_job and l.source = 'kit' and l.ref_id = d.id
     and (l.label is distinct from d.label or l.qty is distinct from d.qty);

  -- ---------- מהתכנון ----------
  for k in select * from public.koolisot where job_id = p_job order by created_at
  loop
    if k.preview->>'kind' = 'wall-layout' then
      v_arr := k.preview->'wall'->'widths';
    elsif k.preview->>'kind' = 'wall' then
      v_arr := k.parts;
    else
      v_arr := null;
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
        v_labels := v_labels || format('קוליסה %s מתוך %s', v_i + 1, v_n);
        v_qtys   := v_qtys || coalesce(
          case jsonb_typeof(v_w)
            when 'number' then (v_w #>> '{}') || ' ס״מ'
            when 'object' then (v_w->>'width') || ' ס״מ'
            else null end, '');
      end loop;
    end if;

    v_want := array[v_grp];
    for v_i in 1 .. array_length(v_labels, 1) loop
      v_want := v_want || (v_labels[v_i] || '|' || v_qtys[v_i]);
    end loop;

    select coalesce(min(grp), '')
      into v_grp_old
      from public.job_loading
     where job_id = p_job and source = 'design' and ref_id = k.id;
    select coalesce(array_agg(label || '|' || coalesce(qty, '') order by sort, created_at), '{}'),
           coalesce(array_agg(done     order by sort, created_at), '{}'),
           coalesce(array_agg(returned order by sort, created_at), '{}')
      into v_cur, v_done, v_ret
      from public.job_loading
     where job_id = p_job and source = 'design' and ref_id = k.id;
    v_cur := array[v_grp_old] || v_cur;

    continue when v_cur = v_want;

    delete from public.job_loading
     where job_id = p_job and source = 'design' and ref_id = k.id;

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
