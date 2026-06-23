-- Persistent cache for paid TrustGate score lookups (survives serverless cold starts).

create table public.paid_trust_cache (
  wallet_address text primary key,
  score numeric,
  tier text,
  recommendation text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint paid_trust_cache_wallet_chk
    check (wallet_address ~ '^0x[a-f0-9]{40}$')
);

create index paid_trust_cache_expires_at_idx
  on public.paid_trust_cache (expires_at);

alter table public.paid_trust_cache enable row level security;