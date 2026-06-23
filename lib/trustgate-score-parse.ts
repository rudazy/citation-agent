/**
 * Shared TrustGate score parsing helpers.
 *
 * Matches the public oracle proxy on trustgated.xyz: numeric scores are kept
 * as integers, and recommendation is derived from score when the upstream body
 * omits it (arc-score responses).
 */

export function coerceTrustScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Integer score for display — TrustGate publishes whole-number scores (0–100). */
export function normalizeTrustScore(value: number): number {
  return Math.trunc(value);
}

/** Wallet routing recommendation bands from TrustGate wallet-rescore. */
export function deriveWalletRecommendation(score: number): string {
  const n = normalizeTrustScore(score);
  if (n === 0) return "BLOCKED";
  if (n < 60) return "TIME_LOCKED";
  if (n < 80) return "INSTANT";
  return "INSTANT_PRIORITY";
}