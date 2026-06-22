-- Per-browser agent wallets (encrypted private keys; one wallet per agent_session cookie)
create table public.user_agent_wallets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null unique,
  address text not null,
  encrypted_private_key text not null
);

create index user_agent_wallets_address_idx on public.user_agent_wallets (address);

alter table public.user_agent_wallets enable row level security;

-- No public policies: only service_role via getAdminClient() may read/write keys
create policy "Service role full access"
  on public.user_agent_wallets
  for all
  to service_role
  using (true)
  with check (true);