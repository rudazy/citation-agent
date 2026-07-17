import { afterEach, describe, expect, it } from "vitest";
import {
  ARC_PUBLIC_RPC_FALLBACKS,
  arcHttpTransport,
  isRpcRateLimitError,
  resolveArcRpcUrls,
} from "@/lib/arc-rpc";

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

describe("resolveArcRpcUrls", () => {
  const prev = {
    primary: process.env.ARC_TESTNET_RPC,
    publicPrimary: process.env.NEXT_PUBLIC_ARC_TESTNET_RPC,
    fallbacks: process.env.ARC_TESTNET_RPC_FALLBACKS,
    publicFallbacks: process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_FALLBACKS,
  };

  afterEach(() => {
    if (prev.primary === undefined) delete process.env.ARC_TESTNET_RPC;
    else process.env.ARC_TESTNET_RPC = prev.primary;
    if (prev.publicPrimary === undefined) delete process.env.NEXT_PUBLIC_ARC_TESTNET_RPC;
    else process.env.NEXT_PUBLIC_ARC_TESTNET_RPC = prev.publicPrimary;
    if (prev.fallbacks === undefined) delete process.env.ARC_TESTNET_RPC_FALLBACKS;
    else process.env.ARC_TESTNET_RPC_FALLBACKS = prev.fallbacks;
    if (prev.publicFallbacks === undefined) {
      delete process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_FALLBACKS;
    } else {
      process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_FALLBACKS = prev.publicFallbacks;
    }
  });

  it("puts explicit primary first and appends public fallbacks without dupes", () => {
    delete process.env.ARC_TESTNET_RPC;
    delete process.env.NEXT_PUBLIC_ARC_TESTNET_RPC;
    delete process.env.ARC_TESTNET_RPC_FALLBACKS;
    const urls = resolveArcRpcUrls("https://rpc.testnet.arc.network");
    expect(urls[0]).toBe("https://rpc.testnet.arc.network");
    expect(urls).toEqual([...new Set(urls)]);
    expect(urls.length).toBeGreaterThanOrEqual(ARC_PUBLIC_RPC_FALLBACKS.length);
    for (const fb of ARC_PUBLIC_RPC_FALLBACKS) {
      expect(urls).toContain(fb);
    }
  });

  it("honors ARC_TESTNET_RPC_FALLBACKS before built-in public list", () => {
    delete process.env.ARC_TESTNET_RPC;
    process.env.ARC_TESTNET_RPC_FALLBACKS =
      "https://custom-a.example/rpc, https://custom-b.example/rpc";
    const urls = resolveArcRpcUrls("https://primary.example/rpc");
    expect(urls.slice(0, 3)).toEqual([
      "https://primary.example/rpc",
      "https://custom-a.example/rpc",
      "https://custom-b.example/rpc",
    ]);
  });
});

describe("arcHttpTransport", () => {
  it("returns a viem transport (fallback multi-endpoint)", () => {
    const transport = arcHttpTransport("https://rpc.testnet.arc.network");
    expect(typeof transport).toBe("function");
  });
});
