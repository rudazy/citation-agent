-- Flat platform fee ledger for on-chain attestations (0.1 USDC per attestation to seller wallet)
create table public.attestation_platform_fees (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  attest_tx_hash text not null unique,
  staker text not null,
  target text not null,
  stake_usdc text not null,
  platform_fee_usdc text not null default '0.1',
  recipient text not null
);

alter table public.attestation_platform_fees enable row level security;

create policy "Allow public read access"
  on public.attestation_platform_fees for select
  using (true);

create policy "Allow service inserts"
  on public.attestation_platform_fees for insert
  to service_role
  with check (true);

alter publication supabase_realtime add table public.attestation_platform_fees;