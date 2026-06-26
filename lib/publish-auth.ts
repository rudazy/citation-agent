/**
 * Server-side creator publish authorization.
 *
 * Creators prove wallet control by signing a timestamped message that includes
 * a digest of the publish payload. The connected wallet from the signature
 * becomes the post identity.
 */

import { getAddress, verifyMessage } from "viem";
import { publishPayloadDigest, type PublishPayloadInput } from "@/lib/publish-payload";
import { consumeAuthSignature } from "@/lib/signature-replay-store";

export const PUBLISH_MESSAGE_PREFIX = "Citation Agent publish";

/** Signed messages older than this are rejected (limits replay). */
export const PUBLISH_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

const DIGEST_PATTERN = /^0x[a-fA-F0-9]{64}$/;

export function publishMessage(timestamp: string, payloadDigest: string): string {
  return `${PUBLISH_MESSAGE_PREFIX} ${timestamp} ${payloadDigest}`;
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
  payloadDigest: `0x${string}`;
};

/**
 * Verify publish auth headers against the expected payload digest.
 * Returns the proven wallet and sign timestamp, or null.
 */
export async function verifyPublishRequest(
  request: Request,
  payload: PublishPayloadInput,
): Promise<VerifiedPublishRequest | null> {
  const address = request.headers.get("x-publish-address");
  const timestamp = request.headers.get("x-publish-timestamp");
  const signature = request.headers.get("x-publish-signature");

  if (!address || !timestamp || !signature) return null;

  const connectedWallet = normalizeWalletAddress(address);
  if (!connectedWallet) return null;
  if (!/^\d+$/.test(timestamp)) return null;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > PUBLISH_AUTH_MAX_AGE_MS) {
    return null;
  }

  const expectedDigest = publishPayloadDigest(payload);
  const message = publishMessage(timestamp, expectedDigest);

  try {
    const valid = await verifyMessage({
      address: connectedWallet,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return null;

    const consumed = await consumeAuthSignature(
      "publish",
      connectedWallet,
      signature,
      PUBLISH_AUTH_MAX_AGE_MS,
    );
    if (!consumed) return null;

    return {
      connectedWallet,
      signedAtMs: ts,
      payloadDigest: expectedDigest,
    };
  } catch {
    return null;
  }
}

/** Parse digest embedded in a publish auth message (for client/server tests). */
export function parsePublishMessageDigest(message: string): `0x${string}` | null {
  const prefix = `${PUBLISH_MESSAGE_PREFIX} `;
  if (!message.startsWith(prefix)) return null;
  const parts = message.slice(prefix.length).split(" ");
  if (parts.length !== 2) return null;
  const digest = parts[1];
  return DIGEST_PATTERN.test(digest) ? (digest as `0x${string}`) : null;
}