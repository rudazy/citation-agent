import { describe, expect, it } from "vitest";
import {
  creatorSlug,
  formatCitationPaymentMemo,
  formatMarketplaceHelloMemo,
  sanitizePaymentMemo,
  truncateMemo,
} from "./payment-memo";

describe("payment-memo", () => {
  it("slugifies creator names", () => {
    expect(creatorSlug("Dr. Elena Vasquez")).toBe("dr-elena-vasquez");
  });

  it("formats citation memos with royalty target", () => {
    expect(formatCitationPaymentMemo("hyperliquid-market-share", "Onchain Alpha Desk")).toBe(
      "citation:hyperliquid-market-share royalty-to:onchain-alpha-desk royalty-split",
    );
  });

  it("formats marketplace hello memo", () => {
    expect(formatMarketplaceHelloMemo()).toBe("marketplace:hello-demo x402-gateway");
  });

  it("truncates long memos", () => {
    const long = "a".repeat(200);
    expect(truncateMemo(long).length).toBeLessThanOrEqual(120);
  });

  it("truncates long citation memos with ASCII only (HTTP header safe)", () => {
    const memo = formatCitationPaymentMemo(
      "cross-venue-liquidation-cascade-anatomy-march-20-f1b8ef0b",
      "Priya Menon · Chain Forensics Unit",
    );
    expect(memo.length).toBeLessThanOrEqual(120);
    expect(sanitizePaymentMemo(memo)).toBe(memo);
    for (const ch of memo) {
      expect(ch.charCodeAt(0)).toBeLessThanOrEqual(255);
    }
  });

  it("strips non-Latin-1 characters before truncation", () => {
    const memo = truncateMemo("café".repeat(40));
    expect(sanitizePaymentMemo(memo)).toBe(memo);
  });
});