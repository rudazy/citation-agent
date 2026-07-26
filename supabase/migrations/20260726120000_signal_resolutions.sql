-- Phase 3: signal outcome logging with a USDC dispute window.
--
-- A creator resolves their own signal against the invalidation condition they
-- pre-committed at publish. The resolution is provisional during a dispute
-- window; anyone may stake USDC against it through the existing Attestation.sol
-- rails (target `resolution:{post_id}`), which freezes it out of accuracy stats
-- until an operator adjudicates.
--
-- No new contract and no new payment rails: disputes reuse the attestation
-- stake flow already used for backing research and researchers.

create table if not exists public.signal_resolutions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- One resolution per signal. FK is safe here (unlike post_endorsements):
  -- only published signals in creator_posts can be resolved, never file seeds.
  post_id text not null unique
    references public.creator_posts (id) on delete cascade,
  resolver_profile_id uuid not null
    references public.platform_profiles (id) on delete cascade,

  outcome text not null check (outcome in ('right', 'wrong', 'void')),
  note text,

  -- Provisional until this passes with no dispute.
  dispute_window_ends_at timestamptz not null,

  -- Dispute: an on-chain USDC stake against `resolution:{post_id}`.
  disputed_at timestamptz,
  disputer_profile_id uuid references public.platform_profiles (id) on delete set null,
  dispute_stake_usdc numeric(20, 6),
  dispute_tx text,
  dispute_reason text,

  -- Operator adjudication. Upheld vs overturned is derived by comparing
  -- adjudicated_outcome against outcome, so it cannot drift out of sync.
  adjudicated_at timestamptz,
  adjudicated_outcome text check (
    adjudicated_outcome is null
    or adjudicated_outcome in ('right', 'wrong', 'void')
  ),
  adjudication_note text,

  constraint signal_resolutions_note_len_chk
    check (note is null or char_length(note) <= 500),
  constraint signal_resolutions_dispute_reason_len_chk
    check (dispute_reason is null or char_length(dispute_reason) <= 500),
  constraint signal_resolutions_dispute_stake_chk
    check (dispute_stake_usdc is null or dispute_stake_usdc > 0),
  -- A dispute is all-or-nothing: timestamp, stake and tx arrive together.
  constraint signal_resolutions_dispute_complete_chk
    check (
      (disputed_at is null and dispute_stake_usdc is null and dispute_tx is null)
      or (disputed_at is not null and dispute_stake_usdc is not null and dispute_tx is not null)
    ),
  -- Adjudication only makes sense once a dispute exists.
  constraint signal_resolutions_adjudication_requires_dispute_chk
    check (adjudicated_at is null or disputed_at is not null),
  constraint signal_resolutions_adjudication_complete_chk
    check (
      (adjudicated_at is null and adjudicated_outcome is null)
      or (adjudicated_at is not null and adjudicated_outcome is not null)
    )
);

create index if not exists signal_resolutions_resolver_idx
  on public.signal_resolutions (resolver_profile_id, created_at desc);

create index if not exists signal_resolutions_recent_idx
  on public.signal_resolutions (created_at desc);

-- Open disputes an operator still needs to adjudicate.
create index if not exists signal_resolutions_open_dispute_idx
  on public.signal_resolutions (disputed_at)
  where disputed_at is not null and adjudicated_at is null;

-- A dispute tx may only be claimed once, so the same on-chain stake cannot be
-- replayed against several resolutions.
create unique index if not exists signal_resolutions_dispute_tx_key
  on public.signal_resolutions (dispute_tx)
  where dispute_tx is not null;

-- Phase 3 notification kinds: outcome logged, disputed, adjudicated.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'follow',
      'comment',
      'reply',
      'sale',
      'endorsement',
      'curator_credit',
      'publish_research',
      'publish_signal',
      'signal_resolved',
      'resolution_disputed',
      'resolution_adjudicated'
    )
  );

-- Service-role only, matching every other table in this schema.
alter table public.signal_resolutions enable row level security;
revoke all on public.signal_resolutions from anon, authenticated;
grant all on public.signal_resolutions to service_role;
