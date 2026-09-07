create or replace function public.notify_shift_assign()
returns trigger language plpgsql security definer set search_path = public as $$
declare added jsonb; eid text; j record;
begin
  if tg_op = 'INSERT' then
    added := coalesce(new.assigned, '[]'::jsonb);
  else
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into added
      from jsonb_array_elements_text(coalesce(new.assigned, '[]'::jsonb)) as t(x)
     where not (coalesce(old.assigned, '[]'::jsonb) ? x);
  end if;

  if added = '[]'::jsonb then return new; end if;

  select title, venue into j from public.jobs where id = new.job_id;

  for eid in select jsonb_array_elements_text(added) loop
    insert into public.notifications (kind, title, body, job_id, audience, employee_id)
    values (
      'shift',
      'שובצת למשמרת',
      -- shifts.start_time הוא text ('08:00'), ו-date עלול להיות ריק
      coalesce(j.title, 'אירוע')
        || coalesce(' · ' || to_char(new.date, 'DD.MM'), '')
        || coalesce(' ' || new.start_time, '')
        || coalesce(' · ' || j.venue, ''),
      new.job_id, 'employee', eid::uuid
    );
  end loop;
  return new;
end $$;
