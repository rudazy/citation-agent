-- Link session agent wallets to a MetaMask address for signed recovery after cookie loss.
alter table public.user_agent_wallets
  add column if not exists linked_wallet text;

create unique index if not exists user_agent_wallets_linked_wallet_uidx
  on public.user_agent_wallets (linked_wallet)
  where linked_wallet is not null;

create index if not exists user_agent_wallets_address_idx2
  on public.user_agent_wallets (lower(address));