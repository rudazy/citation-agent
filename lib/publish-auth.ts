/**
 * Server-side creator publish authorization.
 *
 * Creators prove wallet control by signing a short timestamped message before
 * publishing. The connected wallet from the signature becomes the post identity.
 */

import { getAddress, verifyMessage } from "viem";

export const PUBLISH_MESSAGE_PREFIX = "Citation Agent publish";

/** Signed messages older than this are rejected (limits replay). */
const MAX_AGE_MS = 15 * 60 * 1000;

export function publishMessage(timestamp: string): string {
  return `${PUBLISH_MESSAGE_PREFIX} ${timestamp}`;
}

export function normalizeWalletAddress(value: string): `0x${string}` | null {
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
}

export type VerifiedPublishRequest = {
  connectedWallet: `0x${string}`;
  /** Milliseconds since epoch from x-publish-timestamp (embedded in the signed message). */
  signedAtMs: number;
};

/**
 * Verify publish auth headers. Returns the proven wallet and sign timestamp, or null.
 */
export async function verifyPublishRequest(
  request: Request,
): Promise<VerifiedPublishRequest | null> {
  const address = request.headers.get("x-publish-address");
  const timestamp = request.headers.get("x-publish-timestamp");
  const signature = request.headers.get("x-publish-signature");

  if (!address || !timestamp || !signature) return null;

  const connectedWallet = normalizeWalletAddress(address);
  if (!connectedWallet) return null;
  if (!/^\d+$/.test(timestamp)) return null;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) return null;

  try {
    const valid = await verifyMessage({
      address: connectedWallet,
      message: publishMessage(timestamp),
      signature: signature as `0x${string}`,
    });
    return valid ? { connectedWallet, signedAtMs: ts } : null;
  } catch {
    return null;
  }
}