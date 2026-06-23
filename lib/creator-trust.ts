/**
 * Public trust signal types and formatters (safe for client + server).
 */

import { oracleBase } from "@/lib/trustgate-oracle";
import type { TrustScore } from "@/lib/trustgate";
import type { PaidTrustScore } from "@/lib/trustgate-paid";

export type PublicTrustSignal = {
  score: number;
  tier: string;
  confidence: number;
  recommendation?: string;
  source: "free" | "paid";
  /**
   * Post id this signal was computed for. Display must be bound to this so a
   * score can only ever render on the exact card it was fetched for; a signal
   * with no/foreign `forPostId` must render as Unscored. See lib/trust-display.ts.
   */
  forPostId?: string;
};

export function isPaidTrustLookupAvailable(): boolean {
  return oracleBase() != null;
}

export function trustScoreToSignal(
  trust: TrustScore | null | undefined,
  source: "free" | "paid" = "free",
  forPostId?: string,
): PublicTrustSignal | null {
  if (!trust) return null;
  return {
    score: Math.round(trust.score),
    tier: trust.tier,
    confidence: trust.confidence,
    source,
    ...(forPostId ? { forPostId } : {}),
  };
}

export function paidScoreToSignal(
  score: PaidTrustScore,
  forPostId?: string,
): PublicTrustSignal {
  return {
    score: Math.round(score.score),
    tier: score.tier,
    confidence: 0,
    recommendation: score.recommendation || undefined,
    source: "paid",
    ...(forPostId ? { forPostId } : {}),
  };
}

export function formatTrustLabel(signal: PublicTrustSignal | null | undefined): string | null {
  if (!signal) return null;
  const parts = [`TrustGate ${signal.score}`];
  if (signal.tier) parts.push(signal.tier);
  if (signal.recommendation) parts.push(signal.recommendation);
  return parts.join(" · ");
}