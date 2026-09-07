-- ============================================================
-- שילה — שיחה על ההזמנה. הרץ אחרי quote-share.sql.
-- בטוח להרצה חוזרת.
-- ============================================================

create table if not exists public.job_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  from_client boolean not null default false,
  author      text,
  body        text not null,
  kind        text default 'message'      -- message | change | reject
);

create index if not exists jm_job_idx on public.job_messages (job_id, created_at);

alter table public.job_messages enable row level security;

-- המפיקה ניגשת רק דרך הפונקציות שלמטה, אף פעם לא ישירות
drop policy if exists "jm manager all" on public.job_messages;
create policy "jm manager all" on public.job_messages for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ------------------------------------------------------------
-- המפיקה כותבת. "בקשת שינוי" מחזירה את העבודה לתמחור.
-- ------------------------------------------------------------
create or replace function public.client_post_message(
  p_token text, p_job uuid, p_body text, p_kind text default 'message'
) returns boolean language plpgsql security definer set search_path = public as $$
declare c public.clients; j public.jobs; v_kind text;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then return false; end if;

  select * into j from public.jobs where id = p_job and client_id = c.id;
  if j.id is null then return false; end if;
  if btrim(coalesce(p_body, '')) = '' then return false; end if;

  v_kind := case when p_kind in ('message', 'change', 'reject') then p_kind else 'message' end;

  insert into public.job_messages (job_id, from_client, author, body, kind)
  values (p_job, true, c.name, btrim(p_body), v_kind);

  -- בקשת שינוי פותחת מחדש את ציר התמחור
  if v_kind = 'change' and j.quote_status in ('sent', 'approved', 'rejected') then
    update public.jobs set quote_status = 'needs_quote' where id = p_job;
  end if;

  insert into public.notifications (kind, title, body, job_id, audience)
  values (
    'quote',
    case v_kind
      when 'change' then 'בקשת שינוי מ' || c.name
      when 'reject' then 'ההצעה נדחתה — ' || c.name
      else 'הודעה מ' || c.name end,
    coalesce(j.title, 'עבודה') || ' · ' || left(btrim(p_body), 80),
    p_job, 'manager'
  );
  return true;
end $$;

-- ------------------------------------------------------------
-- דחייה עם סיבה: מעדכנת סטטוס וגם רושמת את ההסבר
-- ------------------------------------------------------------
create or replace function public.client_decide_quote(
  p_token text, p_job uuid, p_approve boolean, p_reason text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare c public.clients; n int; v_title text;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then return false; end if;

  update public.jobs
     set quote_status     = case when p_approve then 'approved' else 'rejected' end,
         quote_decided_at = now()
   where id = p_job and client_id = c.id and quote_status = 'sent';

  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  select title into v_title from public.jobs where id = p_job;

  if btrim(coalesce(p_reason, '')) <> '' then
    insert into public.job_messages (job_id, from_client, author, body, kind)
    values (p_job, true, c.name, btrim(p_reason), case when p_approve then 'message' else 'reject' end);
  end if;

  insert into public.notifications (kind, title, body, job_id, audience)
  values ('quote',
          case when p_approve then 'הצעת מחיר אושרה' else 'הצעת מחיר נדחתה' end,
          coalesce(v_title, 'עבודה') || ' · ' || c.name
            || coalesce(' · ' || left(btrim(p_reason), 60), ''),
          p_job, 'manager');
  return true;
end $$;

drop function if exists public.client_decide_quote(text, uuid, boolean);

grant execute on function public.client_post_message(text, uuid, text, text)        to anon, authenticated;
grant execute on function public.client_decide_quote(text, uuid, boolean, text)     to anon, authenticated;

-- ------------------------------------------------------------
-- דף הלקוח מחזיר גם את השיחה לכל הזמנה
-- ------------------------------------------------------------
create or replace function public.client_portal(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare c public.clients; res json;
begin
  select * into c from public.clients where token = p_token and active limit 1;
  if c.id is null then return null; end if;

  select json_build_object(
    'client', json_build_object('name', c.name, 'company', c.company, 'phone', c.phone),
    'orders', coalesce((
      select json_agg(json_build_object(
        'id', j.id,
        'order_no', j.order_no,
        'title', j.title,
        'event_date', j.event_date,
        'event_time', j.event_time,
        'venue', j.venue,
        'address', j.address,
        'quote_status', j.quote_status,
        'quote_sent_at', j.quote_sent_at,
        'total', j.price,
        'itemized', coalesce(j.show_item_prices, false),
        'items', coalesce((
          select json_agg(json_build_object(
            'name', it->>'name',
            'qty',  it->>'qty',
            'price', case when coalesce(j.show_item_prices, false)
                          then (it->>'price')::numeric else null end
          ))
          from jsonb_array_elements(j.items) it
        ), '[]'::json),
        'messages', coalesce((
          select json_agg(json_build_object(
            'id', m.id, 'from_client', m.from_client, 'author', m.author,
            'body', m.body, 'kind', m.kind, 'created_at', m.created_at
          ) order by m.created_at)
          from public.job_messages m where m.job_id = j.id
        ), '[]'::json)
      ) order by j.created_at desc)
      from public.jobs j where j.client_id = c.id
    ), '[]'::json),
    'catalog', coalesce((
      select json_agg(json_build_object('name', i.name, 'category', i.category) order by i.name)
      from public.inventory i
      where coalesce(i.category, '') <> 'material'
    ), '[]'::json)
  ) into res;
  return res;
end $$;

grant execute on function public.client_portal(text) to anon, authenticated;
