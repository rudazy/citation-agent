-- Optional tip wallet override on the profile. When set, tips settle here;
-- when null, tips settle to default_payout_wallet. Destination resolution
-- only; tip payment mechanics are unchanged.

alter table public.platform_profiles
  add column if not exists tip_payout_wallet text,
  add column if not exists tip_wallet_updated_at timestamptz;
