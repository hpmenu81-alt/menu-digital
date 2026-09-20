alter table public.menus add column tersedia boolean not null default true;
alter table public.menu_promotions add column archived boolean not null default false,
  add constraint archived_promotion_inactive check (not archived or not active);

create table public.menu_rooms (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  floor text not null default '' check (length(floor)<=60),
  position integer not null default 0 check (position between 0 and 9999),
  active boolean not null default true,
  version integer not null default 0 check (version>=0),
  created_at timestamptz not null default now()
);
alter table public.menu_rooms enable row level security;
revoke all on public.menu_rooms from public,anon,authenticated;
grant select on public.menu_rooms to anon,authenticated;
grant insert,update on public.menu_rooms to authenticated;
create policy rooms_read on public.menu_rooms for select to anon,authenticated
  using (active or (select public.is_menu_admin()));
create policy rooms_insert on public.menu_rooms for insert to authenticated
  with check ((select public.is_menu_admin()));
create policy rooms_update on public.menu_rooms for update to authenticated
  using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

-- Preserve all room codes already printed on existing QR labels.
insert into public.menu_rooms(code,label,floor,position)
select code,code,case when code='LOBBY' then '' else 'LANTAI '||left(code,1) end,ordinality::integer
from unnest(array['101','102','103','104','105','106','107','108','110','201','203','204','205','206','207','208','209','210','211','301','302','303','304','305','306','307','308','LOBBY']) with ordinality as r(code,ordinality);

create function public.validate_menu_room() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.code<>old.code or new.version<>old.version+1) then
    raise exception 'Kode room tetap; muat ulang sebelum menyimpan perubahan';
  end if;
  return new;
end $$;
revoke all on function public.validate_menu_room() from public,anon,authenticated;
create trigger validate_menu_room before update on public.menu_rooms for each row execute function public.validate_menu_room();

create table public.menu_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  actor_label text not null,
  entity text not null check (entity in ('menus','menu_promotions','menu_settings','menu_rooms')),
  record_id text not null,
  record_label text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  changes jsonb not null
);
create index menu_audit_recent on public.menu_audit_log(id desc);
create index menu_audit_entity_recent on public.menu_audit_log(entity,id desc);
alter table public.menu_audit_log enable row level security;
revoke all on public.menu_audit_log from public,anon,authenticated;
grant select on public.menu_audit_log to authenticated;
create policy audit_admin_read on public.menu_audit_log for select to authenticated using ((select public.is_menu_admin()));

-- Private trigger only: callers cannot forge, edit or erase audit entries.
create function menu_private.record_menu_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  before_row jsonb := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  after_row jsonb := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  change_set jsonb; source_row jsonb; actor uuid := auth.uid(); actor_name text;
begin
  if tg_table_schema<>'public' or tg_table_name not in ('menus','menu_promotions','menu_settings','menu_rooms') then
    raise exception 'Unsupported audit source';
  end if;
  if actor is not null and not exists(select 1 from menu_private.admins where user_id=actor) then
    raise exception 'Admin required';
  end if;
  select jsonb_object_agg(key,jsonb_build_object('before',before_row->key,'after',after_row->key)) into change_set
  from (select jsonb_object_keys(before_row||after_row) as key) keys
  where key not in ('created_at','updated_at','version') and before_row->key is distinct from after_row->key;
  if change_set is null then return null; end if;
  select email into actor_name from auth.users where id=actor;
  source_row := case when tg_op='DELETE' then before_row else after_row end;
  insert into public.menu_audit_log(actor_id,actor_label,entity,record_id,record_label,operation,changes)
  values(actor,coalesce(actor_name,actor::text,'Sistem / SQL'),tg_table_name,
    coalesce(source_row->>'id',source_row->>'code'),
    coalesce(source_row->>'nama',source_row->>'title',source_row->>'store_name',source_row->>'label','Data'),tg_op,change_set);
  return null;
end $$;
revoke all on function menu_private.record_menu_change() from public,anon,authenticated;
create trigger menus_audit after insert or update or delete on public.menus for each row execute function menu_private.record_menu_change();
create trigger promotions_audit after insert or update or delete on public.menu_promotions for each row execute function menu_private.record_menu_change();
create trigger settings_audit after insert or update or delete on public.menu_settings for each row execute function menu_private.record_menu_change();
create trigger rooms_audit after insert or update or delete on public.menu_rooms for each row execute function menu_private.record_menu_change();

create or replace function public.validate_menu_promotion() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb; selected_id uuid; quantity integer; unit_price integer; menu_active boolean;
  seen uuid[] := '{}'; normal_total bigint := 0;
begin
  -- Always allow an admin to disable a promo, even after a menu becomes unavailable.
  if tg_op='UPDATE' and new.active=false and
    (to_jsonb(new)-'active'-'archived'-'version')=(to_jsonb(old)-'active'-'archived'-'version') then return new; end if;
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
