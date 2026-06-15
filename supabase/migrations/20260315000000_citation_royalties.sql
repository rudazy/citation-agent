-- creator_earnings: per-citation royalty ledger
create table public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  citation_id text not null,
  creator_name text not null,
  creator_wallet text not null,
  payer text not null,
  gross_usdc text not null,
  royalty_usdc text not null,
  platform_usdc text not null,
  gateway_tx text,
  query text
);

alter table public.creator_earnings enable row level security;

create policy "Allow public read access on creator_earnings"
  on public.creator_earnings for select
  using (true);

create policy "Allow service inserts on creator_earnings"
  on public.creator_earnings for insert
  to service_role
  with check (true);

-- agent_reputation: cumulative spend + citation count per payer wallet
create table public.agent_reputation (
  payer text primary key,
  total_spent_usdc numeric not null default 0,
  citation_count integer not null default 0,
  last_payment_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.agent_reputation enable row level security;

create policy "Allow public read access on agent_reputation"
  on public.agent_reputation for select
  using (true);

create policy "Allow service upserts on agent_reputation"
  on public.agent_reputation for insert
  to service_role
  with check (true);

create policy "Allow service updates on agent_reputation"
  on public.agent_reputation for update
  to service_role
  using (true);