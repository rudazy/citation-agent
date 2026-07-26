-- Phase 2: endorsement graph + referral attribution ledger.
--
-- Curator economics accrue off-chain. Unlocks still settle 100% on-chain to the
-- creator payout wallet through the existing x402 single-payee rails; these
-- tables record the credit a curator has earned by routing that unlock.

-- Stamps a desk puts on research or signals it stands behind. post_id is plain
-- text (no FK) to match notifications / post_views: seed listings live in
-- content files, not creator_posts, and must stay endorsable.
create table if not exists public.post_endorsements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id text not null,
  endorser_profile_id uuid not null references public.platform_profiles (id) on delete cascade,
  note text,
  constraint post_endorsements_note_len_chk
    check (note is null or char_length(note) <= 280),
  constraint post_endorsements_unique unique (post_id, endorser_profile_id)
);

create index if not exists post_endorsements_post_idx
  on public.post_endorsements (post_id, created_at desc);

create index if not exists post_endorsements_endorser_idx
  on public.post_endorsements (endorser_profile_id, created_at desc);

-- One row per paid unlock a curator routed. Credit accrues here; settlement of
-- that credit is a later phase (no on-chain split today).
create table if not exists public.unlock_attributions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id text not null,
  curator_profile_id uuid not null references public.platform_profiles (id) on delete cascade,
  -- 'endorsement' when the curator had stamped the post, 'referral' otherwise.
  source text not null check (source in ('endorsement', 'referral')),
  payer text not null,
  gross_usdc numeric(20, 6) not null,
  curator_share_usdc numeric(20, 6) not null,
  gateway_tx text,
  -- Set when accrued credit is actually paid out. Null = pending.
  settled_at timestamptz,
  constraint unlock_attributions_payer_chk
    check (payer ~ '^0x[a-fA-F0-9]{40}$'),
  constraint unlock_attributions_amounts_chk
    check (
      gross_usdc >= 0
      and curator_share_usdc >= 0
      and curator_share_usdc <= gross_usdc
    ),
  -- A buyer can only credit a curator once per post; repeat unlocks do not
  -- re-mint credit.
  constraint unlock_attributions_once_per_buyer unique (post_id, payer)
);

create index if not exists unlock_attributions_curator_idx
  on public.unlock_attributions (curator_profile_id, created_at desc);

create index if not exists unlock_attributions_post_idx
  on public.unlock_attributions (post_id, created_at desc);

create index if not exists unlock_attributions_pending_idx
  on public.unlock_attributions (curator_profile_id) where settled_at is null;

-- Phase 2 notification kinds: stamps received, and followed-desk publishes.
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
      'publish_signal'
    )
  );

-- Service-role only, matching every other table in this schema.
alter table public.post_endorsements enable row level security;
alter table public.unlock_attributions enable row level security;

revoke all on public.post_endorsements from anon, authenticated;
revoke all on public.unlock_attributions from anon, authenticated;

grant all on public.post_endorsements to service_role;
grant all on public.unlock_attributions to service_role;
