/**
 * Public serialization for a signal resolution: the stored row plus the state
 * derived from it (status, whether it counts toward accuracy, dispute window).
 *
 * Lives outside the route modules because Next.js only allows HTTP method and
 * config exports from a route file.
 */

import {
  DISPUTE_WINDOW_HOURS,
  MIN_DISPUTE_STAKE_USDC,
  canDispute,
  deriveResolutionState,
  resolutionDisputeTarget,
} from "@/lib/signal-resolution";
import type { SignalHorizon } from "@/lib/signal-card";
import type { ResolutionRow } from "@/lib/signal-resolution-store";

export type ResolutionViewPost = {
  publishedAt?: string | null;
  signalHorizon?: SignalHorizon | null;
};

export function serializeResolution(
  postId: string,
  resolution: ResolutionRow | null,
  post?: ResolutionViewPost | null,
  now: Date = new Date(),
) {
  const state = deriveResolutionState(
    {
      resolution,
      publishedAt: post?.publishedAt ?? null,
      horizon: post?.signalHorizon ?? null,
    },
    now,
  );

  return {
    post_id: postId,
    status: state.status,
    effective_outcome: state.effectiveOutcome,
    counts_toward_accuracy: state.countsTowardAccuracy,
    overdue: state.overdue,
    adjudication: state.adjudication,
    dispute_target: resolutionDisputeTarget(postId),
    min_dispute_stake_usdc: MIN_DISPUTE_STAKE_USDC,
    dispute_window_hours: DISPUTE_WINDOW_HOURS,
    can_dispute: canDispute(resolution, now),
    ...(resolution
      ? {
          outcome: resolution.outcome,
          note: resolution.note ?? null,
          resolved_at: resolution.resolvedAt,
          dispute_window_ends_at: resolution.disputeWindowEndsAt,
          disputed_at: resolution.disputedAt ?? null,
          dispute_stake_usdc: resolution.disputeStakeUsdc,
          dispute_tx: resolution.disputeTx,
          dispute_reason: resolution.disputeReason,
          adjudicated_at: resolution.adjudicatedAt ?? null,
          adjudicated_outcome: resolution.adjudicatedOutcome ?? null,
          adjudication_note: resolution.adjudicationNote,
          // Where the challenger's stake ended up. Public on purpose: the
          // operator's discretion over slash beneficiaries is only acceptable
          // because the result is auditable by anyone.
          stake_frozen_at: resolution.stakeFrozenAt ?? null,
          freeze_tx: resolution.freezeTx ?? null,
          settlement_action: resolution.settlementAction ?? null,
          settlement_beneficiary: resolution.settlementBeneficiary ?? null,
          settlement_tx: resolution.settlementTx ?? null,
          settled_at: resolution.settledAt ?? null,
        }
      : {}),
  };
}
