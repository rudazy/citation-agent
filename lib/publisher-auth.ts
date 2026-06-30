/**
 * Wallet-signed read auth for publisher dashboards (list own posts).
 */

import { verifyMessage } from "viem";
import { consumeAuthSignature } from "@/lib/signature-replay-store";
import {
  normalizeWalletAddress,
  PUBLISH_AUTH_MAX_AGE_MS,
} from "@/lib/publish-auth";

export const MY_POSTS_MESSAGE_PREFIX = "Citation Agent my-posts";

export function myPostsMessage(timestamp: string): string {
  return `${MY_POSTS_MESSAGE_PREFIX} ${timestamp}`;
}

/**
 * Verify my-posts auth headers. Returns the proven wallet or null.
 */
export async function verifyMyPostsRequest(request: Request): Promise<`0x${string}` | null> {
  const address = request.headers.get("x-my-posts-address");
  const timestamp = request.headers.get("x-my-posts-timestamp");
  const signature = request.headers.get("x-my-posts-signature");

  if (!address || !timestamp || !signature) return null;

  const connectedWallet = normalizeWalletAddress(address);
  if (!connectedWallet) return null;
  if (!/^\d+$/.test(timestamp)) return null;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > PUBLISH_AUTH_MAX_AGE_MS) {
    return null;
  }

  const message = myPostsMessage(timestamp);

  try {
    const valid = await verifyMessage({
      address: connectedWallet,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return null;

    const consumed = await consumeAuthSignature(
      "my-posts",
      connectedWallet,
      signature,
      PUBLISH_AUTH_MAX_AGE_MS,
    );
    if (!consumed) return null;

    return connectedWallet;
  } catch {
    return null;
  }
}