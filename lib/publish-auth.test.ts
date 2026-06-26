import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  normalizeWalletAddress,
  publishMessage,
  PUBLISH_MESSAGE_PREFIX,
  verifyPublishRequest,
} from "@/lib/publish-auth";
import { publishPayloadDigest } from "@/lib/publish-payload";
import { resetSignatureReplayStore } from "@/lib/signature-replay-store";

const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const account = privateKeyToAccount(PRIVATE_KEY);

const SAMPLE_PAYLOAD = {
  title: "Hyperliquid",
  subheading: "Market share",
  body: "Analysis body",
  priceUsdc: "0.01",
  tags: ["defi"],
};

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/marketplace/citations", {
    method: "POST",
    headers,
  });
}

describe("publish-auth", () => {
  beforeEach(() => {
    resetSignatureReplayStore();
  });

  afterEach(() => {
    resetSignatureReplayStore();
  });

  it("builds deterministic publish message with payload digest", () => {
    const digest = publishPayloadDigest(SAMPLE_PAYLOAD);
    expect(publishMessage("1710000000000", digest)).toBe(
      `${PUBLISH_MESSAGE_PREFIX} 1710000000000 ${digest}`,
    );
  });

  it("normalizes valid wallet addresses", () => {
    expect(
      normalizeWalletAddress("0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62"),
    ).toBe("0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62");
  });

  it("rejects invalid wallet addresses", () => {
    expect(normalizeWalletAddress("not-a-wallet")).toBeNull();
    expect(normalizeWalletAddress("0x123")).toBeNull();
  });

  it("accepts publish auth bound to the payload and rejects body tampering", async () => {
    const timestamp = Date.now().toString();
    const digest = publishPayloadDigest(SAMPLE_PAYLOAD);
    const signature = await account.signMessage({
      message: publishMessage(timestamp, digest),
    });

    const headers = {
      "x-publish-address": account.address,
      "x-publish-timestamp": timestamp,
      "x-publish-signature": signature,
    };

    const verified = await verifyPublishRequest(requestWith(headers), SAMPLE_PAYLOAD);
    expect(verified?.connectedWallet).toBe(account.address);

    const tampered = await verifyPublishRequest(requestWith(headers), {
      ...SAMPLE_PAYLOAD,
      body: "Different body",
    });
    expect(tampered).toBeNull();
  });

  it("rejects replayed publish signatures", async () => {
    const timestamp = Date.now().toString();
    const digest = publishPayloadDigest(SAMPLE_PAYLOAD);
    const signature = await account.signMessage({
      message: publishMessage(timestamp, digest),
    });
    const headers = {
      "x-publish-address": account.address,
      "x-publish-timestamp": timestamp,
      "x-publish-signature": signature,
    };

    expect(await verifyPublishRequest(requestWith(headers), SAMPLE_PAYLOAD)).not.toBeNull();
    expect(await verifyPublishRequest(requestWith(headers), SAMPLE_PAYLOAD)).toBeNull();
  });
});