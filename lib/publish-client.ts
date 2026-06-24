/**
 * Client-side helpers for creator publish: wallet sign + auth headers.
 */

import type { EthereumProvider } from "@/lib/ethereum-provider";

const PUBLISH_MESSAGE_PREFIX = "Citation Agent publish";

export type PublishAuth = {
  address: `0x${string}`;
  timestamp: string;
  signature: string;
};

/** Prompt the connected wallet to sign a fresh publish authorization message. */
export async function signPublishAuth(
  ethereum: EthereumProvider,
  account: `0x${string}`,
): Promise<PublishAuth> {
  const timestamp = Date.now().toString();
  const message = `${PUBLISH_MESSAGE_PREFIX} ${timestamp}`;
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, account],
  })) as string;
  return { address: account, timestamp, signature };
}

export function publishAuthHeaderFields(auth: PublishAuth): Record<string, string> {
  return {
    "x-publish-address": auth.address,
    "x-publish-timestamp": auth.timestamp,
    "x-publish-signature": auth.signature,
  };
}

export function publishHeaders(auth: PublishAuth): Record<string, string> {
  return {
    ...publishAuthHeaderFields(auth),
    "content-type": "application/json",
  };
}