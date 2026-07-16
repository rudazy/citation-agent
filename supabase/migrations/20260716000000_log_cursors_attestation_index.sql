-- Persistent eth_getLogs cursors + attestation event index + block timestamp cache.
-- Required for incremental Claims tab indexing on Arc public RPC (serverless-safe).
-- Apply to the hosted Supabase project before production relies on cursors:
--   npx tsx scripts/apply-sql-migration.mts supabase/migrations/20260716000000_log_cursors_attestation_index.sql

-- Last fully scanned block per contract address (lowercase 0x…).
create table if not exists public.log_cursors (
  address text primary key,
  last_block bigint not null check (last_block >= 0),
  updated_at timestamptz not null default now(),
  constraint log_cursors_address_chk
    check (address ~ '^0x[a-f0-9]{40}$')
);

alter table public.log_cursors enable row level security;

-- No public policies: service_role only (dashboard/API via getAdminClient).
grant all on public.log_cursors to service_role;

-- Unix block timestamps reused during log enrichment (many logs share a block).
create table if not exists public.arc_block_timestamps (
  block_number bigint primary key check (block_number >= 0),
  block_timestamp bigint not null check (block_timestamp >= 0),
  updated_at timestamptz not null default now()
);

alter table public.arc_block_timestamps enable row level security;
grant all on public.arc_block_timestamps to service_role;

-- Decoded Attested events so cold starts do not re-scan history from deploy.
create table if not exists public.attestation_event_index (
  contract_address text not null,
  tx_hash text not null,
  log_index integer not null,
  target text not null,
  claim text not null,
  amount_units text not null,
  staker text not null,
  block_number bigint not null,
  block_timestamp bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (contract_address, tx_hash, log_index),
  constraint attestation_event_index_address_chk
    check (contract_address ~ '^0x[a-f0-9]{40}$'),
  constraint attestation_event_index_tx_chk
    check (tx_hash ~ '^0x[a-f0-9]{64}$'),
  constraint attestation_event_index_staker_chk
    check (staker ~ '^0x[a-f0-9]{40}$')
);

create index if not exists attestation_event_index_contract_block_idx
  on public.attestation_event_index (contract_address, block_number desc);

create index if not exists attestation_event_index_target_idx
  on public.attestation_event_index (target);

alter table public.attestation_event_index enable row level security;
grant all on public.attestation_event_index to service_role;
