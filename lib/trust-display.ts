/**
 * Render-time guard binding a trust signal to the exact post it was computed for.
 *
 * TrustGate scores are per identity wallet and are fetched per post id. A signal
 * must never render on a card other than the one it was fetched for. Every signal
 * is stamped with `forPostId` at the moment it is produced (free reader and paid
 * lookup alike); this guard refuses to surface a signal whose stamp does not match
 * the card. Effect:
 *   - a paid score can never leak onto a sibling post, and
 *   - a post whose wallet returns 402 (no signal of its own) stays Unscored even
 *     when another card is holding a cached paid score.
 *
 * Fail-closed: a missing or foreign `forPostId` resolves to null (Unscored).
 */

export type PostBoundTrustSignal = { forPostId?: string };

export function selectTrustForPost<T extends PostBoundTrustSignal>(
  postId: string,
  signal: T | null | undefined,
): T | null {
  if (!signal) return null;
  if (!postId) return null;
  if (signal.forPostId !== postId) return null;
  return signal;
}
