import { describe, expect, it } from "vitest";
import {
  normalizeWalletAddress,
  publishMessage,
  PUBLISH_MESSAGE_PREFIX,
} from "./publish-auth";

describe("publish-auth", () => {
  it("builds deterministic publish message", () => {
    expect(publishMessage("1710000000000")).toBe(
      `${PUBLISH_MESSAGE_PREFIX} 1710000000000`,
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
});