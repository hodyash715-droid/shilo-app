-- ============================================================
-- שילה — שליחת הצעת מחיר ובחירת רמת הפירוט ללקוח.
-- הרץ אחרי RUN-ME.sql. בטוח להרצה חוזרת.
-- ============================================================

alter table public.clients add column if not exists email text;

-- ברירת מחדל: הלקוח רואה סכום כולל בלבד. שי פותח פירוט כשהוא רוצה.
alter table public.jobs add column if not exists show_item_prices boolean default false;

-- ---------- דף הלקוח: פירוט מחירים רק כשהותר ----------
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
            -- המחיר יוצא רק אם שי אישר פירוט
            'price', case when coalesce(j.show_item_prices, false)
                          then (it->>'price')::numeric else null end
          ))
          from jsonb_array_elements(j.items) it
        ), '[]'::json)
      ) order by j.created_at desc)
      from public.jobs j where j.client_id = c.id
    ), '[]'::json),
    'catalog', coalesce((
      select json_agg(json_build_object('name', i.name, 'category', i.category) order by i.name)
      from public.inventory i
      where coalesce(i.category, '') <> 'material'   -- חומרי גלם אינם מוצר ללקוח
    ), '[]'::json)
  ) into res;
  return res;
end $$;

grant execute on function public.client_portal(text) to anon, authenticated;
