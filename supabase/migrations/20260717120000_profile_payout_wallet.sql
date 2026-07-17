-- Set-once payout wallet on the profile: configured during first publish or on
-- the profile page, reused for every later publish and for tips. Existing
-- posts keep the payout_wallet they were published with.

alter table public.platform_profiles
  add column if not exists default_payout_wallet text,
  add column if not exists payout_wallet_updated_at timestamptz;
