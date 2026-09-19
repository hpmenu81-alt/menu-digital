alter table public.menu_promotions
  add column banner_image_url text not null default '',
  add column banner_position integer not null default 0,
  add constraint promotion_banner_position_valid check (banner_position between 0 and 9999),
  add constraint promotion_banner_image_valid check
    (banner_image_url = '' or (length(banner_image_url) <= 2048 and banner_image_url ~ '^https://[^[:space:]]+$'));
