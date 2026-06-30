/**
 * Client-side helpers for creator publish: wallet sign + auth headers.
 */

import {
  myPostsMessage,
  MY_POSTS_MESSAGE_PREFIX,
} from "@/lib/publisher-auth";
import {
  publishMessage,
  PUBLISH_MESSAGE_PREFIX,
} from "@/lib/publish-auth";
import {
  articleImageUploadDigestFromFile,
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

/** Sign publish authorization bound to a precomputed payload digest. */
export async function signPublishAuthForDigest(
  ethereum: EthereumProvider,
  account: `0x${string}`,
  payloadDigest: `0x${string}`,
): Promise<PublishAuth> {
  const timestamp = Date.now().toString();
  const message = publishMessage(timestamp, payloadDigest);
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, account],
  })) as string;
  return { address: account, timestamp, signature, payloadDigest };
}

/** Prompt the connected wallet to sign publish authorization bound to the payload. */
export async function signPublishAuth(
  ethereum: EthereumProvider,
  account: `0x${string}`,
  payload: PublishPayloadInput,
): Promise<PublishAuth> {
  return signPublishAuthForDigest(ethereum, account, publishPayloadDigest(payload));
}

/** Sign authorization bound to a specific image file (mime, size, filename). */
export async function signArticleImageUploadAuth(
  ethereum: EthereumProvider,
  account: `0x${string}`,
  file: File,
): Promise<PublishAuth> {
  return signPublishAuthForDigest(
    ethereum,
    account,
    articleImageUploadDigestFromFile(file),
  );
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

export type MyPostsAuth = {
  address: `0x${string}`;
  timestamp: string;
  signature: string;
};

/** Sign a short message so the server can list posts for this wallet. */
export async function signMyPostsAuth(
  ethereum: EthereumProvider,
  account: `0x${string}`,
): Promise<MyPostsAuth> {
  const timestamp = Date.now().toString();
  const message = myPostsMessage(timestamp);
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, account],
  })) as string;
  return { address: account, timestamp, signature };
}

export function myPostsHeaders(auth: MyPostsAuth): Record<string, string> {
  return {
    "x-my-posts-address": auth.address,
    "x-my-posts-timestamp": auth.timestamp,
    "x-my-posts-signature": auth.signature,
  };
}

export { MY_POSTS_MESSAGE_PREFIX };