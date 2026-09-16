create table public.menu_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 100),
  description text not null default '' check (length(description)<=500),
  kind text not null check (kind in ('discount','bundle')),
  items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 50),
  discount_type text not null default 'percent' check (discount_type in ('percent','amount')),
  discount_value integer not null default 0,
  bundle_price integer,
  active boolean not null default false,
  banner boolean not null default false,
  version integer not null default 0 check (version>=0),
  created_at timestamptz not null default now(),
  constraint valid_promotion_price check (
    (kind='discount' and bundle_price is null and discount_value>0 and (discount_type='amount' or discount_value<=99))
    or (kind='bundle' and bundle_price is not null and bundle_price>0 and discount_value=0)
  )
);
alter table public.menu_promotions enable row level security;
revoke all on public.menu_promotions from public, anon, authenticated;
grant select on public.menu_promotions to anon, authenticated;
grant insert, update on public.menu_promotions to authenticated;
create policy promotions_read on public.menu_promotions for select to anon, authenticated
using (active or (select public.is_menu_admin()));
create policy promotions_insert on public.menu_promotions for insert to authenticated
with check ((select public.is_menu_admin()));
create policy promotions_update on public.menu_promotions for update to authenticated
using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

-- Invoker trigger validates menu references, quantities and actual prices.
-- It runs with the caller's permissions and existing menu RLS.
create function public.validate_menu_promotion() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb; selected_id uuid; quantity integer; unit_price integer; menu_active boolean;
  seen uuid[] := '{}'; normal_total bigint := 0;
begin
  -- Always allow an admin to disable a promo, even after a menu becomes unavailable.
  if tg_op='UPDATE' and new.active=false and
    (to_jsonb(new)-'active'-'version')=(to_jsonb(old)-'active'-'version') then return new; end if;
  if jsonb_typeof(new.items)<>'array' or jsonb_array_length(new.items) not between 1 and 50 then
    raise exception 'Pilih 1-50 menu';
  end if;
  for item in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(item)<>'object' or not (item ? 'menu_id' and item ? 'quantity')
      or jsonb_typeof(item->'quantity')<>'number' or (item->>'quantity')!~'^[0-9]+$' then
      raise exception 'Isi promo tidak valid';
    end if;
    selected_id := (item->>'menu_id')::uuid;
    quantity := (item->>'quantity')::integer;
    if selected_id is null or selected_id=any(seen) or quantity not between 1 and 99
      or (new.kind='discount' and quantity<>1) then raise exception 'Menu/jumlah tidak valid'; end if;
    seen := array_append(seen,selected_id);
    select harga,aktif into unit_price,menu_active from public.menus where id=selected_id;
    if not found or unit_price<=0 or (new.active and not coalesce(menu_active,false)) then
      raise exception 'Menu tidak tersedia atau nonaktif';
    end if;
    normal_total := normal_total + unit_price::bigint*quantity;
    if new.kind='discount' and ((new.discount_type='amount' and new.discount_value>=unit_price)
      or (new.discount_type='percent' and round(unit_price::numeric*(100-new.discount_value)/100)<1)) then
      raise exception 'Diskon terlalu besar';
    end if;
  end loop;
  if new.kind='bundle' and new.bundle_price>=normal_total then raise exception 'Harga paket harus di bawah harga normal'; end if;
  return new;
end;
$$;
revoke all on function public.validate_menu_promotion() from public, anon, authenticated;
create trigger validate_menu_promotion before insert or update on public.menu_promotions
for each row execute function public.validate_menu_promotion();
