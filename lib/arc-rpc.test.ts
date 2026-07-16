import { describe, expect, it } from "vitest";
import { arcHttpTransport, isRpcRateLimitError } from "@/lib/arc-rpc";

describe("isRpcRateLimitError", () => {
  it("matches the Arc public RPC limit message", () => {
    expect(
      isRpcRateLimitError(new Error("RPC Request failed. Details: request limit reached")),
    ).toBe(true);
  });

  it("matches HTTP 429 and generic rate-limit phrasing", () => {
    expect(isRpcRateLimitError(new Error("HTTP request failed. Status: 429"))).toBe(true);
    expect(isRpcRateLimitError(new Error("Too Many Requests"))).toBe(true);
  });

  it("does not match contract reverts or unrelated errors", () => {
    expect(
      isRpcRateLimitError(new Error("execution reverted: ERC20: transfer amount exceeds allowance")),
    ).toBe(false);
    expect(isRpcRateLimitError(new Error("fetch failed"))).toBe(false);
    expect(isRpcRateLimitError(null)).toBe(false);
  });
});

describe("arcHttpTransport", () => {
  it("returns a viem http transport", () => {
    const transport = arcHttpTransport("https://rpc.testnet.arc.network");
    expect(typeof transport).toBe("function");
  });
});
