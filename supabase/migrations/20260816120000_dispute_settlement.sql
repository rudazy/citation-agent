-- Dispute settlement: record what happened to the challenger's staked USDC.
--
-- Adjudication already fixes which outcome stands, but until now nothing moved
-- the stake — the deployed v1 attestation contract had no exit path at all, so
-- a challenger who lost was in exactly the same position as one who won, and
-- filing a false dispute was free.
--
-- AttestationV2 adds freeze / release / slash. The arbiter is the operator
-- wallet signing in its own browser (there is no server-side key), so these
-- columns record transactions that already happened on-chain and were verified
-- against the contract before being written.

alter table public.signal_resolutions
  -- Which stake, and where. The arbiter functions address a stake by
  -- (target, index); the index comes from the StakeOpened event on the dispute
  -- tx, which is the only exact source for it.
  add column if not exists dispute_stake_index integer,
  add column if not exists dispute_contract text,

  -- Freeze holds the stake open past its lock while the dispute is settled.
  add column if not exists freeze_tx text,
  add column if not exists stake_frozen_at timestamptz,

  -- Settlement. `release` returns the stake to the challenger (dispute upheld),
  -- `slash` pays it to a beneficiary the operator names (dispute overturned).
  add column if not exists settlement_action text,
  add column if not exists settlement_tx text,
  add column if not exists settlement_beneficiary text,
  add column if not exists settled_at timestamptz;

alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_settlement_action_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_settlement_action_chk
  check (settlement_action is null or settlement_action in ('release', 'slash'));

-- A stake index only means anything alongside the contract it lives on.
alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_stake_ref_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_stake_ref_chk
  check (
    (dispute_stake_index is null and dispute_contract is null)
    or (dispute_stake_index is not null and dispute_contract is not null)
  );

alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_stake_index_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_stake_index_chk
  check (dispute_stake_index is null or dispute_stake_index >= 0);

-- A freeze is all-or-nothing, like the dispute columns above it.
alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_freeze_complete_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_freeze_complete_chk
  check (
    (freeze_tx is null and stake_frozen_at is null)
    or (freeze_tx is not null and stake_frozen_at is not null)
  );

-- A freeze only makes sense once a dispute exists.
alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_freeze_requires_dispute_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_freeze_requires_dispute_chk
  check (stake_frozen_at is null or disputed_at is not null);

-- Settlement arrives as a complete set.
alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_settlement_complete_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_settlement_complete_chk
  check (
    (settled_at is null and settlement_tx is null and settlement_action is null)
    or (settled_at is not null and settlement_tx is not null and settlement_action is not null)
  );

-- The stake cannot be moved before a verdict exists.
alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_settlement_requires_adjudication_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_settlement_requires_adjudication_chk
  check (settled_at is null or adjudicated_at is not null);

-- A slash must say where the money went; a release must not, since it can only
-- ever go back to the staker.
alter table public.signal_resolutions
  drop constraint if exists signal_resolutions_settlement_beneficiary_chk;
alter table public.signal_resolutions
  add constraint signal_resolutions_settlement_beneficiary_chk
  check (
    (settlement_action = 'slash' and settlement_beneficiary is not null)
    or (settlement_action = 'release' and settlement_beneficiary is null)
    or settlement_action is null
  );

-- Neither on-chain tx may be claimed by more than one resolution, matching the
-- guard already in place for dispute_tx.
create unique index if not exists signal_resolutions_freeze_tx_key
  on public.signal_resolutions (freeze_tx)
  where freeze_tx is not null;

create unique index if not exists signal_resolutions_settlement_tx_key
  on public.signal_resolutions (settlement_tx)
  where settlement_tx is not null;

-- Disputes whose stake is adjudicated but still sitting in the contract.
create index if not exists signal_resolutions_unsettled_idx
  on public.signal_resolutions (adjudicated_at)
  where disputed_at is not null and settled_at is null;
