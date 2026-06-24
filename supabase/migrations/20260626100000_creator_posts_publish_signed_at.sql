-- Wallet sign timestamp at publish (ms from x-publish-timestamp, stored as timestamptz).
alter table public.creator_posts
  add column if not exists publish_signed_at timestamptz;