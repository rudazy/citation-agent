import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  consumeAuthSignature,
  resetSignatureReplayStore,
} from "@/lib/signature-replay-store";

const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const account = privateKeyToAccount(PRIVATE_KEY);

describe("consumeAuthSignature", () => {
  afterEach(() => {
    resetSignatureReplayStore();
  });

  it("accepts a signature once and rejects replay", async () => {
    const signature = await account.signMessage({ message: "replay-test-1" });

    expect(
      await consumeAuthSignature("operator", account.address, signature, 60_000),
    ).toBe(true);
    expect(
      await consumeAuthSignature("operator", account.address, signature, 60_000),
    ).toBe(false);
  });

  it("isolates namespaces", async () => {
    const signature = await account.signMessage({ message: "replay-test-2" });

    expect(
      await consumeAuthSignature("operator", account.address, signature, 60_000),
    ).toBe(true);
    expect(
      await consumeAuthSignature("publish", account.address, signature, 60_000),
    ).toBe(true);
  });
});