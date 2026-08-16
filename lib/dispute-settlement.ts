/**
 * Dispute settlement — deciding what happens to a challenger's staked USDC.
 *
 * Adjudication fixes which outcome stands. Settlement moves the stake, and the
 * two must never disagree, so the action is *derived* from the same comparison
 * that produces upheld-vs-overturned rather than being chosen separately:
 *
 * - adjudicated outcome **differs** from the creator's call → the challenger was
 *   right, the dispute is upheld → **release** the stake back to them
 * - adjudicated outcome **matches** the creator's call → the challenger was
 *   wrong, the dispute is overturned → **slash** the stake to a beneficiary the
 *   operator names
 *
 * Pure: no I/O, clock injected. The contract enforces its own guards on the
 * transaction, so an optimistic prediction here costs a revert, not funds.
 */

import type { SignalOutcome } from "@/lib/signal-resolution";

/** AttestationV2.SLASH_DELAY — 24h in ms, the public warning before a seizure. */
export const SLASH_DELAY_MS = 24 * 60 * 60 * 1000;

export type SettlementAction = "release" | "slash";

export const SETTLEMENT_ACTIONS: readonly SettlementAction[] = [
  "release",
  "slash",
];

export function isSettlementAction(value: unknown): value is SettlementAction {
  return (
    typeof value === "string" &&
    SETTLEMENT_ACTIONS.includes(value as SettlementAction)
  );
}

/**
 * Which way a settled dispute pays out.
 *
 * Deliberately derived rather than operator-chosen: the operator decides the
 * *outcome* and, for a slash, the *beneficiary* — never whether a losing
 * challenger gets their money back anyway.
 */
export function settlementForAdjudication(
  originalOutcome: SignalOutcome,
  adjudicatedOutcome: SignalOutcome,
): SettlementAction {
  return adjudicatedOutcome === originalOutcome ? "slash" : "release";
}

/** True when the adjudication went against the creator's original call. */
export function disputeUpheld(
  originalOutcome: SignalOutcome,
  adjudicatedOutcome: SignalOutcome,
): boolean {
  return adjudicatedOutcome !== originalOutcome;
}

export type DisputeStage =
  /** No dispute on this resolution. */
  | "none"
  /** Disputed, stake not yet frozen — the operator should act. */
  | "awaiting_freeze"
  /** Stake frozen, no verdict recorded yet. */
  | "frozen"
  /** Verdict recorded, stake not yet moved. */
  | "awaiting_settlement"
  /** Stake moved and recorded. */
  | "settled";

/**
 * Timestamps are optional as well as nullable because `ResolutionRecord` marks
 * them optional — absent and null both mean "has not happened".
 */
export type DisputeSettlementState = {
  disputedAt?: string | null;
  stakeFrozenAt?: string | null;
  adjudicatedAt?: string | null;
  settledAt?: string | null;
};

/** Where a dispute sits, for the operator queue. */
export function disputeStage(state: DisputeSettlementState): DisputeStage {
  if (!state.disputedAt) return "none";
  if (state.settledAt) return "settled";
  if (state.adjudicatedAt) return "awaiting_settlement";
  if (state.stakeFrozenAt) return "frozen";
  return "awaiting_freeze";
}

export type SettlementReadiness =
  | { ok: true; action: SettlementAction }
  | { ok: false; reason: string };

/**
 * Whether the stake can be moved right now.
 *
 * Mirrors the contract: `slash` requires a prior freeze **and** `SLASH_DELAY`
 * elapsed since it, so a seizure is always announced on-chain a day ahead.
 * `release` has no such requirement — handing someone their own funds back is
 * never a seizure.
 */
export function settlementReadiness(params: {
  state: DisputeSettlementState;
  originalOutcome: SignalOutcome;
  adjudicatedOutcome: SignalOutcome | null | undefined;
  nowMs: number;
}): SettlementReadiness {
  const { state, originalOutcome, adjudicatedOutcome, nowMs } = params;

  if (!state.disputedAt) return { ok: false, reason: "No dispute to settle" };
  if (state.settledAt) return { ok: false, reason: "Stake already settled" };
  if (!state.adjudicatedAt || !adjudicatedOutcome) {
    return { ok: false, reason: "Adjudicate the dispute first" };
  }

  const action = settlementForAdjudication(originalOutcome, adjudicatedOutcome);
  if (action === "release") return { ok: true, action };

  if (!state.stakeFrozenAt) {
    return { ok: false, reason: "Freeze the stake before slashing" };
  }
  const frozenAtMs = new Date(state.stakeFrozenAt).getTime();
  if (!Number.isFinite(frozenAtMs)) {
    return { ok: false, reason: "Freeze the stake before slashing" };
  }
  const readyAt = frozenAtMs + SLASH_DELAY_MS;
  if (nowMs < readyAt) {
    const hours = Math.ceil((readyAt - nowMs) / (60 * 60 * 1000));
    return {
      ok: false,
      reason: `Slash delay not elapsed — ${hours}h remaining`,
    };
  }

  return { ok: true, action };
}

/** A beneficiary address is required for slash, and meaningless for release. */
export function validateBeneficiary(
  action: SettlementAction,
  beneficiary: unknown,
): { ok: true; beneficiary: `0x${string}` | null } | { ok: false; error: string } {
  if (action === "release") return { ok: true, beneficiary: null };

  const raw = typeof beneficiary === "string" ? beneficiary.trim() : "";
  if (!raw) return { ok: false, error: "A slash needs a beneficiary address" };
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return { ok: false, error: "Beneficiary must be a valid address" };
  }
  if (/^0x0{40}$/.test(raw)) {
    return { ok: false, error: "Beneficiary cannot be the zero address" };
  }
  return { ok: true, beneficiary: raw as `0x${string}` };
}
