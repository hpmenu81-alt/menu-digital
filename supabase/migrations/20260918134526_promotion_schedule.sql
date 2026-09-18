alter table public.menu_promotions
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add constraint promotion_schedule_valid check
    ((starts_at is null or isfinite(starts_at)) and (ends_at is null or isfinite(ends_at))
     and (starts_at is null or ends_at is null or ends_at>starts_at));

create function public.menu_server_time() returns timestamptz
language sql stable security invoker set search_path = ''
as $$ select statement_timestamp(); $$;
revoke all on function public.menu_server_time() from public;
grant execute on function public.menu_server_time() to anon,authenticated;
