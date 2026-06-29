alter table public.user_agent_wallets
  add column if not exists linked_wallet_verified boolean not null default false;