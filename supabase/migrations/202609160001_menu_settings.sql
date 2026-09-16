-- Jalankan sekali di SQL Editor sebelum mengunggah file fitur baru.
begin;
create table if not exists public.menu_settings (
  id integer primary key default 1 check (id = 1),
  version integer not null default 0 check (version >= 0),
  store_name text not null check (length(btrim(store_name)) between 1 and 100),
  whatsapp text not null check (whatsapp ~ '^[1-9][0-9]{7,14}$'),
  address text not null default '' check (length(address) <= 500),
  opening_hours text not null default '' check (length(opening_hours) <= 500),
  information text not null default '' check (length(information) <= 2000),
  category_order text[] not null default '{}' check (cardinality(category_order) <= 10000 and array_position(category_order,null) is null),
  menu_order text[] not null default '{}' check (cardinality(menu_order) <= 10000 and array_position(menu_order,null) is null)
);
alter table public.menu_settings enable row level security;
revoke all on public.menu_settings from public, anon, authenticated;
grant select on public.menu_settings to anon, authenticated;
grant update on public.menu_settings to authenticated;
drop policy if exists menu_settings_read on public.menu_settings;
create policy menu_settings_read on public.menu_settings for select to anon, authenticated using (true);
drop policy if exists menu_settings_update on public.menu_settings;
create policy menu_settings_update on public.menu_settings for update to authenticated
using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));
drop policy if exists menu_settings_update_guard on public.menu_settings;
create policy menu_settings_update_guard on public.menu_settings as restrictive for update to public
using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));
insert into public.menu_settings (id,store_name,whatsapp,address)
values (1,'Happy Puppy Panjaitan','6281255763976','Samarinda')
on conflict (id) do nothing;
commit;
