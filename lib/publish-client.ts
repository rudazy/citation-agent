/**
 * Client-side helpers for creator publish: wallet sign + auth headers.
 */

import {
  publishMessage,
  PUBLISH_MESSAGE_PREFIX,
} from "@/lib/publish-auth";
import {
  publishPayloadDigest,
  type PublishPayloadInput,
} from "@/lib/publish-payload";
import type { EthereumProvider } from "@/lib/ethereum-provider";

export type PublishAuth = {
  address: `0x${string}`;
  timestamp: string;
  signature: string;
  payloadDigest: `0x${string}`;
};

/** Prompt the connected wallet to sign publish authorization bound to the payload. */
export async function signPublishAuth(
  ethereum: EthereumProvider,
  account: `0x${string}`,
  payload: PublishPayloadInput,
): Promise<PublishAuth> {
  const timestamp = Date.now().toString();
  const payloadDigest = publishPayloadDigest(payload);
  const message = publishMessage(timestamp, payloadDigest);
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, account],
  })) as string;
  return { address: account, timestamp, signature, payloadDigest };
}

export { PUBLISH_MESSAGE_PREFIX };

export function publishAuthHeaderFields(auth: PublishAuth): Record<string, string> {
  return {
    "x-publish-address": auth.address,
    "x-publish-timestamp": auth.timestamp,
    "x-publish-signature": auth.signature,
    "x-publish-digest": auth.payloadDigest,
  };
}

export function publishHeaders(auth: PublishAuth): Record<string, string> {
  return {
    ...publishAuthHeaderFields(auth),
    "content-type": "application/json",
  };
}