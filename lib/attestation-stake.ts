import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import { attestationTxKey } from "@/lib/attestation-claim-merge";

/**
 * Stake lifecycle view logic for AttestationV2.
 *
 * The claims index decodes `attest` calldata and therefore never learns a
 * stake's array index or status. Withdrawing needs both, so stakes come from
 * `getAttestations(target)` instead — position in the returned array *is* the
 * index the contract expects.
 *
 * Pure: no I/O, clock injected. The contract re-checks every condition on the
 * transaction itself, so an over-optimistic prediction here costs a revert, not
 * funds.
 */

/** Matches the contract's StakeStatus enum order exactly. */
export const STAKE_STATUS_LABEL = {
  0: "Active",
  1: "Withdrawn",
  2: "Released",
  3: "Slashed",
  4: "Reclaimed",
} as const;

export type StakeStatusCode = keyof typeof STAKE_STATUS_LABEL;

/** AttestationV2.MAX_FREEZE_DURATION — 30 days, in seconds. */
export const MAX_FREEZE_DURATION_SECONDS = 2_592_000;

export type StakeRecord = {
  /** Position in the contract's array for this target. */
  index: number;
  staker: `0x${string}`;
  target: string;
  claim: string;
  amountUsdc: string;
  /** Unix seconds. */
  timestamp: number;
  unlockAt: number;
  /** 0 when not currently frozen. */
  frozenAt: number;
  /** Anchors the freeze deadline; never reset by unfreeze. 0 if never frozen. */
  firstFrozenAt: number;
  status: StakeStatusCode;
};

export type StakeAction =
  | { kind: "withdraw"; label: string }
  | { kind: "reclaim"; label: string }
  | { kind: "none"; reason: string };

export function isTerminal(status: StakeStatusCode): boolean {
  return status !== 0;
}

export function statusLabel(status: StakeStatusCode): string {
  return STAKE_STATUS_LABEL[status] ?? "Unknown";
}

/**
 * Human-readable gap, e.g. "6d 4h" or "12m". Always rounds down, so a countdown
 * never claims a stake is available a moment before the chain agrees.
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return "under a minute";
}

/**
 * What the staker can do with this stake right now.
 *
 * Mirrors the contract's guards:
 * - withdraw  — Active, not frozen, lock elapsed
 * - reclaim   — Active, frozen, MAX_FREEZE_DURATION elapsed since the *first*
 *               freeze, and the staker's own lock elapsed
 *
 * A frozen stake inside the freeze window is deliberately shown as "under
 * dispute" rather than a countdown: the expected outcome is arbiter settlement,
 * not the timeout.
 */
export function stakeAction(
  stake: Pick<
    StakeRecord,
    "status" | "unlockAt" | "frozenAt" | "firstFrozenAt"
  >,
  nowSeconds: number,
  maxFreezeDuration: number = MAX_FREEZE_DURATION_SECONDS,
): StakeAction {
  if (isTerminal(stake.status)) {
    return { kind: "none", reason: statusLabel(stake.status) };
  }

  const lockElapsed = nowSeconds >= stake.unlockAt;

  if (stake.frozenAt === 0) {
    if (!lockElapsed) {
      return {
        kind: "none",
        reason: `Locked for ${formatDuration(stake.unlockAt - nowSeconds)}`,
      };
    }
    return { kind: "withdraw", label: "Withdraw" };
  }

  // Frozen: the arbiter is expected to settle it. Reclaim is the safety valve
  // for a freeze nobody ever acted on.
  const freezeExpiresAt = stake.firstFrozenAt + maxFreezeDuration;
  if (nowSeconds < freezeExpiresAt) {
    return {
      kind: "none",
      reason: `Under dispute · reclaimable in ${formatDuration(freezeExpiresAt - nowSeconds)}`,
    };
  }
  if (!lockElapsed) {
    return {
      kind: "none",
      reason: `Freeze expired · locked for ${formatDuration(stake.unlockAt - nowSeconds)}`,
    };
  }
  return { kind: "reclaim", label: "Reclaim" };
}

/** Stakes belonging to one wallet, newest first. */
export function ownStakes(
  stakes: StakeRecord[],
  wallet: string | null | undefined,
): StakeRecord[] {
  if (!wallet) return [];
  const key = wallet.trim().toLowerCase();
  if (!key) return [];
  return stakes
    .filter((s) => s.staker.toLowerCase() === key)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** Total still recoverable by this wallet on a target (Active stakes only). */
export function activeStakeTotalUsdc(stakes: StakeRecord[]): string {
  const total = stakes
    .filter((s) => !isTerminal(s.status))
    .reduce((sum, s) => sum + (parseFloat(s.amountUsdc) || 0), 0);
  return total.toFixed(6).replace(/\.?0+$/, "") || "0";
}

/** A claims-index row used only to discover targets and leftover v1 stakes. */
export type IndexedStakeHint = {
  target: string;
  claim: string;
  amountUsdc: string;
  timestamp: number;
  staker: `0x${string}`;
  txHash: `0x${string}` | null;
};

/**
 * Split a wallet's history into live v2 stakes (withdrawable once unlocked)
 * and leftover v1 rows (no exit path on that contract).
 *
 * The index is event history, so a withdrawn v2 stake still appears there.
 * On-chain `getAttestations` is the authority for anything on the current
 * contract; the index only fills targets the current contract has never seen.
 */
export function partitionWalletStakes(
  indexed: IndexedStakeHint[],
  onChain: StakeRecord[],
): { live: StakeRecord[]; legacy: IndexedStakeHint[] } {
  const liveTargets = new Set(
    onChain.map((row) => canonicalizeAttestationTarget(row.target)),
  );

  const seenTx = new Set<string>();
  const legacy: IndexedStakeHint[] = [];
  for (const row of indexed) {
    const target = canonicalizeAttestationTarget(row.target);
    if (liveTargets.has(target)) continue;
    const key = attestationTxKey(row.txHash);
    if (key) {
      if (seenTx.has(key)) continue;
      seenTx.add(key);
    }
    legacy.push({ ...row, target });
  }

  const live = [...onChain].sort((a, b) => b.timestamp - a.timestamp);
  legacy.sort((a, b) => b.timestamp - a.timestamp);
  return { live, legacy };
}
