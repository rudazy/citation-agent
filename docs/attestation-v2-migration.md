# Attestation v2 — migration notes

Status: **contract ready, not deployed.** The live product still writes to v1.

## Why v2 exists

`contracts/Attestation.sol` moves stake into itself (`Attestation.sol:50`) and
exposes **no withdraw, no release, and no slash function at all**. There is no
proxy and no `selfdestruct`. Funds have only ever moved in.

Two consequences:

1. **Every stake ever filed is locked forever.** This is not limited to disputes.
   Research backing — the "N backers · X USDC" figure the catalog renders through
   `lib/research-backing.ts` — is equally trapped. Nobody, including the
   deployer, can move those funds.
2. **Disputes have no teeth.** A challenger who loses an adjudication ends up in
   exactly the same position as one who wins, so filing a false dispute is free.
   `lib/signal-resolution-store.ts` settles the *outcome* of a dispute but can
   never settle the *stake*.

On testnet this is play money. On mainnet it is real USDC seized by an immutable
contract, so this must be fixed before any mainnet deployment.

### What is currently trapped

| | |
| --- | --- |
| v1 address | `0xc8886a68f2160a57a01b32aae542b6eec5ca3d02` (Arc Testnet, chain 5042002) |
| Deploy block | `48323587` |
| USDC held | **261.84 USDC** — `cast call 0x3600…0000 "balanceOf(address)(uint256)"` → `261840000` |
| Measured at | Block `57314544`, 2026-08-16 |

This figure only grows while the app keeps writing to v1.

## What v2 changes

`contracts/AttestationV2.sol`. The write path and event are deliberately
unchanged, so existing tooling keeps working:

- `attest(string,string,uint256)` — identical signature, so the calldata decode in
  `lib/verify-attestation-tx.ts:42` works against v2 with no change
- `Attested(target, staker, claim, amount, platformFee)` — identical event, so
  `lib/attestation-index.ts` and `lib/arcscan-attestations.ts` index v2 unchanged

Added, all of it new surface:

| Function | Caller | Rules |
| --- | --- | --- |
| `withdraw(target, index)` | staker | Active, not frozen, lock elapsed |
| `reclaimExpiredFreeze(target, index)` | staker | Active, frozen, `MAX_FREEZE_DURATION` (30d) elapsed since the first freeze, lock elapsed |
| `freeze(target, index)` | arbiter | Active, not already frozen |
| `unfreeze(target, index)` | arbiter | Active and frozen |
| `release(target, index)` | arbiter | Active. Returns to staker, ignoring lock and freeze |
| `slash(target, index, beneficiary)` | arbiter | Active, **frozen**, `SLASH_DELAY` (24h) elapsed, freeze **not** expired, beneficiary non-zero |
| `proposeArbiter` / `acceptArbiter` | arbiter / pending | Two-step handover |

Deploy parameters: `usdc` (see below), `lockPeriod` **7 days** (covers the 72h
resolution dispute window plus adjudication headroom), arbiter and platform fee
recipient both the operator wallet `0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`.

### The settlement token is a constructor argument, not a constant

v1 hardcoded `address public constant USDC = 0x3600…0000`. Circle documents that
address as **Arc Testnet** and states plainly that mainnet addresses are not yet
published (checked 2026-08-16). Hardcoding it would mean that if the mainnet
address differs, this audited source becomes undeployable to mainnet without a
code change and a fresh review — in September, under launch pressure.

v2 takes `usdc` in the constructor and stores it as `immutable`. Same audited
source deploys to both networks; only the argument changes. **Confirm the real
mainnet USDC address before a mainnet deploy — do not assume it matches testnet.**
`run()` in the deploy script is testnet-only by design; use `deployWith(...)` for
anything else.

New events — `StakeOpened`, `StakeWithdrawn`, `StakeReclaimed`, `StakeFrozen`,
`StakeUnfrozen`, `StakeReleased`, `StakeSlashed`, `ArbiterProposed`,
`ArbiterTransferred`. `StakeReclaimed` carries the original `frozenAt`, so the
public record distinguishes an abandoned freeze from a settled dispute.
`StakeOpened` carries the array index so indexers need not reconstruct it by
counting `Attested` events per target.

### Three properties worth re-checking in review

1. **Slashing is announced before it happens.** `slash` requires a prior public
   `StakeFrozen` event and a 24h delay, so the arbiter cannot silently seize an
   honest backer's stake. This is the main on-chain constraint on a trusted role.
2. **Checks-effects-interactions on all three exit paths**, via `_closeStake` —
   terminal status and balance bookkeeping land before the token transfer. A
   `nonReentrant` mutex sits on top; the status enum alone already makes a
   re-entered exit revert.
3. **Two-step arbiter handover.** A typo'd single-step transfer would brick the
   escrow and permanently re-trap every frozen stake — exactly the bug being fixed.

### Every stake has a guaranteed exit

`MAX_FREEZE_DURATION` (30 days) closes the last trap. Four scenarios, four exits,
no path where a stake is stuck:

| Scenario | Exit | Who calls it |
| --- | --- | --- |
| Backed, undisputed | `withdraw` after the 7-day lock | staker |
| Disputed and lost | `slash` to a named beneficiary | arbiter |
| Disputed and won | `release` | arbiter |
| Disputed, then abandoned by the arbiter | `reclaimExpiredFreeze` after 30 days | **staker** |

The timeout default is deliberately **staker-favouring**: an unresolved freeze
returns the money to the person it was taken from, because they were never shown
to be wrong. It does not auto-slash and does not pay anyone else. Nothing in the
timeout path is callable by the arbiter — past 30 days their power over that
stake is gone, and `slash` starts reverting with `Freeze expired`.

Why 30 days: a legitimate dispute finishes in under 4 days (72h window + 24h
slash delay), so 30 leaves generous room for a slow-but-honest adjudication while
still bounding abuse. Set it much tighter and a real dispute could time out and
auto-return a stake that should have been slashed.

**The re-freeze bypass is closed.** The deadline anchors to `firstFrozenAt`,
which is set once and never reset. An arbiter who unfreezes and re-freezes gets a
fresh 24h `SLASH_DELAY` warning but no additional total time, so the clock cannot
be rolled forward to trap a stake indefinitely. This is regression-tested
(`test_refreezing_cannotExtendTheDeadline`).

One deliberate constraint: reclaim still respects the staker's own `lockPeriod`.
Timing out a freeze restores the ordinary rules — it does not exempt anyone from
the commitment they chose. With the default 7-day lock this never binds, since
the lock is far shorter than the freeze timeout.

### Deliberate design note: `totalStaked` changes meaning

In v1 it only ever grew. In v2 it is **live** stake and decrements when a stake
exits. `lifetimeStaked` was added alongside it and never decrements, so backing
figures do not silently drop when stakers withdraw. Anything currently reading
"total backing" should read `lifetimeStaked`; anything asking "what is still at
risk" should read `totalStaked`.

`totalEscrowed` tracks the contract's total outstanding obligation, so solvency
is publicly checkable: `USDC.balanceOf(contract) >= totalEscrowed`.

## Arc mainnet context (researched 2026-08-16)

- Public mainnet is **16 September 2026**. Arc is in private mainnet now with
  100+ builders.
- `docs.arc.io` documents **testnet only** — no mainnet chain ID, RPC, or
  explorer is published, and the contract addresses page states "Mainnet
  addresses are not yet available."
- **Circle has published no migration guidance at all.** The full doc set
  (enumerated via `docs.arc.io/llms.txt`) has no page on mainnet, migration,
  testnet deprecation, or going to production.
- Working assumption, mechanical rather than sourced: **testnet state does not
  carry to mainnet.** Different chain, different genesis. Everything on-chain —
  this contract, the unlock ledger, attestations — is redeployed in September, and
  the USDC stranded in v1 evaporates with the testnet rather than needing recovery.

Open questions for Circle Support: does the public testnet keep running past
16 Sep, and are mainnet deploys allowlisted at launch (testnet needs a support
ticket for some features, 24–48h turnaround)?

## Deploy

```
forge script script/DeployAttestationV2.s.sol:DeployAttestationV2 ^
  --rpc-url https://rpc.testnet.arc.network ^
  --chain-id 5042002 ^
  --broadcast ^
  --private-key %DEPLOYER_PRIVATE_KEY%
```

Then verify (see the full command in `script/DeployAttestationV2.s.sol`) and set:

| Variable | Value |
| --- | --- |
| `ATTESTATION_ADDRESS` | new v2 address |
| `NEXT_PUBLIC_ATTESTATION_ADDRESS` | new v2 address |
| `ATTESTATION_DEPLOY_BLOCK` | v2 deploy block |

**Do not reuse the v1 deploy block.** The indexer scans from it forward, and
starting a v2 scan 9M blocks early will hit the Arc RPC limits documented in
`tasks/lessons.md`.

## Wiring status

**Done — cutover complete.**

1. ✅ `lib/attestation.ts` — `ATTESTATION_ABI` carries v2's **9-field** `Attest`
   tuple plus the lifecycle functions and events. A regression test pins the
   tuple shape, because a short decode does not throw; it silently mislabels
   trailing values.
2. ✅ v1 kept as a **read-only historical address** (`ATTESTATION_V1_ADDRESS`).
   `loadAttestationEvents` accepts several contracts and the index merges them,
   so pre-cutover claims keep rendering. A self-healing Arcscan backfill runs only
   if a superseded contract has nothing in the store.

3. ✅ **Dispute settlement wired.** Resolved the arbiter-key question by keeping
   the existing model: **no server-side key**, the operator signs freeze /
   release / slash in their own wallet from a dashboard queue, and the API
   verifies each tx against the contract before recording it. Manual freeze is
   safe on timing — a challenger's stake is locked 7 days against a 72h dispute
   window, so there is roughly a 7-day margin.
4. ✅ Settlement tx, action, and beneficiary are recorded on
   `signal_resolutions` and exposed by `serializeResolution`, so where a slashed
   stake went is publicly auditable. That record is the reason operator
   discretion over the beneficiary is acceptable at all.
5. ✅ **Withdraw UI shipped.** `GET /api/attestation/stakes?target=…&staker=…`
   reads `getAttestations` from the current contract, where array position *is*
   the index `withdraw`/`reclaimExpiredFreeze` expect. `lib/attestation-stake.ts`
   derives the permitted action (pure, clock injected) and
   `components/attest/my-stakes-panel.tsx` renders it inside the registry
   detail view. A wallet whose stakes predate the cutover is told plainly that
   they sit on a contract with no withdrawal path.
6. Decide whether the USDC stranded in v1 is written off publicly or quietly. It
   cannot be recovered either way.

**Note on disputes:** `verify-attestation-tx.ts` checks stake txs against the
current contract only, so a dispute opened against a v1 stake tx is now rejected.
That is correct — v1 stakes are unrecoverable, so no new dispute should use one.

## Test harness note

`forge build` was failing repo-wide before this work: `lib/forge-std` was absent,
so `test/Attestation.t.sol` and both deploy scripts could not compile and no
contract test had ever been runnable in this checkout. Install it with:

```
forge install foundry-rs/forge-std --no-git
```

`lib/forge-std/` is gitignored, so nothing enters the repo. Note that
`foundry.toml` sets `libs = ["lib"]`, which is also the Next.js TypeScript
directory; it works because only `lib/forge-std` is ever resolved there.
