/**
 * Signal resolution (Phase 3) — pure outcome logic, safe to import on the client.
 *
 * A creator resolves their own signal against the invalidation condition they
 * pre-committed at publish. The resolution is *provisional* during a dispute
 * window; a USDC stake against it (through the existing attestation rails)
 * freezes it out of accuracy stats until an operator adjudicates.
 *
 * The anti-gaming property is that silence is visible: a signal past its
 * horizon that was never resolved shows as `expired_unresolved` and drags the
 * desk's resolution rate down, so a creator cannot quietly bury losers by
 * resolving only their winners.
 */

import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import type { SignalHorizon } from "@/lib/signal-card";

export const SIGNAL_OUTCOMES = ["right", "wrong", "void"] as const;
export type SignalOutcome = (typeof SIGNAL_OUTCOMES)[number];

export const SIGNAL_OUTCOME_LABELS: Record<SignalOutcome, string> = {
  right: "Right",
  wrong: "Wrong",
  void: "Void",
};

/** Hours a resolution stays provisional and open to dispute. */
export const DISPUTE_WINDOW_HOURS = 72;

/** Matches the on-chain attestation minimum stake. */
export const MIN_DISPUTE_STAKE_USDC = 0.1;

export const RESOLUTION_NOTE_MAX_LEN = 500;

export function isSignalOutcome(value: unknown): value is SignalOutcome {
  return (
    typeof value === "string" && (SIGNAL_OUTCOMES as readonly string[]).includes(value)
  );
}

/** Canonical attestation target a dispute stake must be filed against. */
export function resolutionDisputeTarget(postId: string): string {
  return canonicalizeAttestationTarget(`resolution:${postId.trim()}`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a signal's horizon runs out, in epoch ms.
 *
 * Only fixed horizons expire. "event" and "open" signals have no deadline the
 * platform can infer, so they never count as overdue — treating them as expired
 * would punish creators for a horizon they never claimed.
 */
export function signalExpiryMs(
  publishedAt: string | null | undefined,
  horizon: SignalHorizon | null | undefined,
): number | null {
  if (!publishedAt || !horizon) return null;
  const publishedMs = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedMs)) return null;

  if (horizon === "30d") return publishedMs + 30 * DAY_MS;
  if (horizon === "90d") return publishedMs + 90 * DAY_MS;
  return null;
}

export function disputeWindowEndsAtMs(resolvedAtMs: number): number {
  return resolvedAtMs + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
}

export type ResolutionStatus =
  /** No resolution filed and the horizon has not run out. */
  | "unresolved"
  /** Horizon passed with no resolution — counts against the resolution rate. */
  | "expired_unresolved"
  /** Filed, still inside the dispute window. */
  | "provisional"
  /** Dispute window closed with no challenge. Counts toward accuracy. */
  | "final"
  /** Challenged with a USDC stake, awaiting adjudication. Excluded from accuracy. */
  | "disputed"
  /** An operator settled the dispute. Counts toward accuracy. */
  | "adjudicated";

export const RESOLUTION_STATUS_LABELS: Record<ResolutionStatus, string> = {
  unresolved: "Open",
  expired_unresolved: "Expired unresolved",
  provisional: "Provisional",
  final: "Final",
  disputed: "Disputed",
  adjudicated: "Adjudicated",
};

/** The stored row, in the shape the pure helpers need. */
export type ResolutionRecord = {
  outcome: SignalOutcome;
  note?: string | null;
  disputeWindowEndsAt: string;
  disputedAt?: string | null;
  adjudicatedAt?: string | null;
  adjudicatedOutcome?: SignalOutcome | null;
};

export type ResolutionState = {
  status: ResolutionStatus;
  /** Outcome that stands today: the adjudicated one when present. */
  effectiveOutcome: SignalOutcome | null;
  /** Only final and adjudicated resolutions feed accuracy. */
  countsTowardAccuracy: boolean;
  /** True once the horizon has run out (fixed horizons only). */
  overdue: boolean;
  /** Set when a dispute has been adjudicated. */
  adjudication: "upheld" | "overturned" | null;
};

/**
 * Derive the public state of a signal from its resolution row (if any).
 * Pure: the clock is injected so status transitions are testable.
 */
export function deriveResolutionState(
  input: {
    resolution?: ResolutionRecord | null;
    publishedAt?: string | null;
    horizon?: SignalHorizon | null;
  },
  now: Date = new Date(),
): ResolutionState {
  const nowMs = now.getTime();
  const expiryMs = signalExpiryMs(input.publishedAt, input.horizon);
  const overdue = expiryMs !== null && nowMs >= expiryMs;

  const resolution = input.resolution;
  if (!resolution) {
    return {
      status: overdue ? "expired_unresolved" : "unresolved",
      effectiveOutcome: null,
      countsTowardAccuracy: false,
      overdue,
      adjudication: null,
    };
  }

  if (resolution.adjudicatedAt && resolution.adjudicatedOutcome) {
    return {
      status: "adjudicated",
      effectiveOutcome: resolution.adjudicatedOutcome,
      countsTowardAccuracy: true,
      overdue,
      adjudication:
        resolution.adjudicatedOutcome === resolution.outcome
          ? "upheld"
          : "overturned",
    };
  }

  if (resolution.disputedAt) {
    return {
      status: "disputed",
      effectiveOutcome: resolution.outcome,
      countsTowardAccuracy: false,
      overdue,
      adjudication: null,
    };
  }

  const windowEndsMs = new Date(resolution.disputeWindowEndsAt).getTime();
  const windowClosed = Number.isFinite(windowEndsMs) && nowMs >= windowEndsMs;

  return {
    status: windowClosed ? "final" : "provisional",
    effectiveOutcome: resolution.outcome,
    countsTowardAccuracy: windowClosed,
    overdue,
    adjudication: null,
  };
}

/** True while a resolution can still be challenged. */
export function canDispute(
  resolution: ResolutionRecord | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!resolution) return false;
  if (resolution.disputedAt) return false;
  const windowEndsMs = new Date(resolution.disputeWindowEndsAt).getTime();
  if (!Number.isFinite(windowEndsMs)) return false;
  return now.getTime() < windowEndsMs;
}

export function validateResolutionNote(
  raw: unknown,
): { ok: true; note: string | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, note: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "Resolution note must be text" };
  }
  const note = raw.trim();
  if (!note) return { ok: true, note: null };
  if (note.length > RESOLUTION_NOTE_MAX_LEN) {
    return {
      ok: false,
      error: `Resolution note must be ${RESOLUTION_NOTE_MAX_LEN} characters or fewer`,
    };
  }
  return { ok: true, note };
}

/** A dispute stake must clear the on-chain minimum to count. */
export function isSufficientDisputeStake(stakeUsdc: string | number): boolean {
  const stake = typeof stakeUsdc === "number" ? stakeUsdc : parseFloat(stakeUsdc);
  if (!Number.isFinite(stake)) return false;
  // Tolerance absorbs 6dp formatting drift on an exactly-minimum stake.
  return stake >= MIN_DISPUTE_STAKE_USDC - 1e-9;
}

export type DeskAccuracyEntry = {
  resolution?: ResolutionRecord | null;
  publishedAt?: string | null;
  horizon?: SignalHorizon | null;
};

export type DeskAccuracy = {
  /** Signals whose outcome is settled (final or adjudicated). */
  scored: number;
  right: number;
  wrong: number;
  /** Void outcomes are settled but excluded from the accuracy denominator. */
  voided: number;
  /** right / (right + wrong), 0-100 with one decimal. Null with nothing scored. */
  accuracyPct: number | null;
  provisional: number;
  disputed: number;
  expiredUnresolved: number;
  /** Signals that reached a deadline and got an outcome, over all that did. */
  resolutionRatePct: number | null;
};

export const EMPTY_DESK_ACCURACY: DeskAccuracy = {
  scored: 0,
  right: 0,
  wrong: 0,
  voided: 0,
  accuracyPct: null,
  provisional: 0,
  disputed: 0,
  expiredUnresolved: 0,
  resolutionRatePct: null,
};

/**
 * Roll a desk's signals into public accuracy figures.
 *
 * Two separate numbers by design, because one alone is gameable:
 *  - accuracy asks "when you called it, were you right"
 *  - resolution rate asks "do you actually close the loop, or bury losers"
 */
export function summarizeDeskAccuracy(
  entries: DeskAccuracyEntry[],
  now: Date = new Date(),
): DeskAccuracy {
  let scored = 0;
  let right = 0;
  let wrong = 0;
  let voided = 0;
  let provisional = 0;
  let disputed = 0;
  let expiredUnresolved = 0;
  let dueCount = 0;
  let dueResolved = 0;

  for (const entry of entries) {
    const state = deriveResolutionState(entry, now);

    // "Due" = the desk owed the public an outcome: either a passed horizon or a
    // resolution it already filed.
    if (state.overdue || entry.resolution) {
      dueCount += 1;
      if (entry.resolution) dueResolved += 1;
    }

    switch (state.status) {
      case "expired_unresolved":
        expiredUnresolved += 1;
        break;
      case "provisional":
        provisional += 1;
        break;
      case "disputed":
        disputed += 1;
        break;
      case "final":
      case "adjudicated": {
        scored += 1;
        if (state.effectiveOutcome === "right") right += 1;
        else if (state.effectiveOutcome === "wrong") wrong += 1;
        else voided += 1;
        break;
      }
      default:
        break;
    }
  }

  const called = right + wrong;

  return {
    scored,
    right,
    wrong,
    voided,
    accuracyPct: called > 0 ? Math.round((right / called) * 1000) / 10 : null,
    provisional,
    disputed,
    expiredUnresolved,
    resolutionRatePct:
      dueCount > 0 ? Math.round((dueResolved / dueCount) * 1000) / 10 : null,
  };
}
