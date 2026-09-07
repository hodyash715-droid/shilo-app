-- ============================================================
-- שילה — נירמול שיבוץ המשמרת.
-- אותו עובד יכול להופיע פעמיים ב-assigned, ואז המשמרת נראית
-- מאוישת (2/2) בזמן שיש בה אדם אחד. הממשק מונע את זה, אבל
-- זה כשל שעולה איש בשטח — אז נועלים אותו במסד.
-- בטוח להרצה חוזרת.
-- ============================================================

create or replace function public.normalize_shift_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.assigned := coalesce((
    select jsonb_agg(distinct x)
      from jsonb_array_elements_text(coalesce(new.assigned, '[]'::jsonb)) as t(x)
     where exists (select 1 from public.employees e where e.id::text = x)
  ), '[]'::jsonb);
  return new;
end $$;

drop trigger if exists shifts_normalize on public.shifts;
create trigger shifts_normalize before insert or update on public.shifts
  for each row execute function public.normalize_shift_assigned();

-- ניקוי כפילויות שכבר קיימות
update public.shifts s
   set assigned = coalesce((
     select jsonb_agg(distinct x)
       from jsonb_array_elements_text(s.assigned) as t(x)
      where exists (select 1 from public.employees e where e.id::text = x)
   ), '[]'::jsonb)
 where s.assigned is not null and s.assigned <> '[]'::jsonb;
