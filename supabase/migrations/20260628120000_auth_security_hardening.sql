-- Bounty tier: signature replay dedup + agent session rotation tracking.

create table public.used_auth_signatures (
  signature_hash text primary key,
  namespace text not null,
  wallet_address text not null,
  used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index used_auth_signatures_expires_at_idx
  on public.used_auth_signatures (expires_at);

alter table public.used_auth_signatures enable row level security;

create policy "Service role full access on used_auth_signatures"
  on public.used_auth_signatures
  for all
  to service_role
  using (true)
  with check (true);

create table public.agent_sessions (
  session_id text primary key,
  created_at timestamptz not null default now(),
  last_rotated_at timestamptz not null default now()
);

alter table public.agent_sessions enable row level security;

create policy "Service role full access on agent_sessions"
  on public.agent_sessions
  for all
  to service_role
  using (true)
  with check (true);