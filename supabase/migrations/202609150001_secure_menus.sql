-- Run as the project database owner before deploying the new admin page.
begin;
create schema if not exists menu_private;
revoke all on schema menu_private from public, anon, authenticated;
create table if not exists menu_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on menu_private.admins from public, anon, authenticated;
alter table menu_private.admins enable row level security;

create or replace function public.is_menu_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from menu_private.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_menu_admin() from public;
grant execute on function public.is_menu_admin() to anon, authenticated;

alter table public.menus enable row level security;
revoke all on public.menus from public, anon, authenticated;
grant select on public.menus to anon, authenticated;
grant insert, update on public.menus to authenticated;
-- Support existing serial/identity IDs without granting access to other sequences.
do $$
declare sequence_name text;
begin
  sequence_name := pg_get_serial_sequence('public.menus', 'id');
  if sequence_name is not null then
    execute format('grant usage, select on sequence %s to authenticated', sequence_name);
  end if;
end $$;

-- Restrictive guards also constrain older permissive policies, which are
-- intentionally retained. They cannot reopen anonymous writes or hidden rows.
drop policy if exists menu_read_guard on public.menus;
create policy menu_read_guard on public.menus as restrictive for select to public
using (aktif is true or (select public.is_menu_admin()));
drop policy if exists menu_insert_guard on public.menus;
create policy menu_insert_guard on public.menus as restrictive for insert to public
with check ((select public.is_menu_admin()));
drop policy if exists menu_update_guard on public.menus;
create policy menu_update_guard on public.menus as restrictive for update to public
using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));
drop policy if exists menu_delete_guard on public.menus;
create policy menu_delete_guard on public.menus as restrictive for delete to public using (false);
drop policy if exists menu_read on public.menus;
create policy menu_read on public.menus for select to anon, authenticated
using (aktif is true or (select public.is_menu_admin()));
drop policy if exists menu_insert on public.menus;
create policy menu_insert on public.menus for insert to authenticated
with check ((select public.is_menu_admin()));
drop policy if exists menu_update on public.menus;
create policy menu_update on public.menus for update to authenticated
using ((select public.is_menu_admin())) with check ((select public.is_menu_admin()));

-- NOT VALID preserves legacy rows but enforces these rules for new writes.
alter table public.menus drop constraint if exists menus_positive_integer_price;
alter table public.menus add constraint menus_positive_integer_price
check (harga is not null and harga > 0 and harga <= 9007199254740991 and harga = trunc(harga::numeric)) not valid;
alter table public.menus drop constraint if exists menus_required_text;
alter table public.menus add constraint menus_required_text
check (nama is not null and length(btrim(nama)) > 0 and kategori is not null and length(btrim(kategori)) > 0) not valid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Scope guards to this bucket; other buckets retain their existing rules.
drop policy if exists menu_images_write_guard on storage.objects;
create policy menu_images_write_guard on storage.objects as restrictive for insert to public
with check (bucket_id <> 'menu-images' or (select public.is_menu_admin()));
drop policy if exists menu_images_update_guard on storage.objects;
create policy menu_images_update_guard on storage.objects as restrictive for update to public
using (bucket_id <> 'menu-images' or (select public.is_menu_admin()))
with check (bucket_id <> 'menu-images' or (select public.is_menu_admin()));
drop policy if exists menu_images_delete_guard on storage.objects;
create policy menu_images_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id <> 'menu-images' or (select public.is_menu_admin()));
drop policy if exists menu_images_admin on storage.objects;
create policy menu_images_admin on storage.objects for all to authenticated
using (bucket_id = 'menu-images' and (select public.is_menu_admin()))
with check (bucket_id = 'menu-images' and (select public.is_menu_admin()));
commit;
