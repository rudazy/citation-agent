-- Scope withdrawal audit rows to the wallet that initiated them
alter table public.withdrawals
  add column if not exists wallet_address text,
  add column if not exists role text not null default 'seller'
    check (role in ('seller', 'agent'));

create index if not exists withdrawals_wallet_address_idx
  on public.withdrawals (wallet_address);

-- Stop exposing every user's withdrawals via anon/publishable clients
drop policy if exists "Allow public read access" on public.withdrawals;