/**
 * Payout destination for a publish. The publish page has no wallet field:
 * an explicit payout can only arrive from direct API callers. On a first
 * publish with nothing stored, the signing wallet silently becomes the
 * profile's default payout wallet for future publishes and tips.
 */
export function resolvePublishPayout(params: {
  explicitPayout?: string | null;
  storedPayout?: string | null;
  connectedWallet: string;
}): { payoutWallet: string; storeAsDefault: string | null } {
  const explicit = params.explicitPayout?.trim() || null;
  const stored = params.storedPayout?.trim() || null;

  if (explicit) {
    return { payoutWallet: explicit, storeAsDefault: stored ? null : explicit };
  }
  if (stored) {
    return { payoutWallet: stored, storeAsDefault: null };
  }
  return { payoutWallet: params.connectedWallet, storeAsDefault: params.connectedWallet };
}
