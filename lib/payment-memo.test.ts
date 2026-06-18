import { describe, expect, it } from "vitest";
import {
  creatorSlug,
  formatCitationPaymentMemo,
  formatMarketplaceHelloMemo,
  truncateMemo,
} from "./payment-memo";

describe("payment-memo", () => {
  it("slugifies creator names", () => {
    expect(creatorSlug("Dr. Elena Vasquez")).toBe("dr-elena-vasquez");
  });

  it("formats citation memos with royalty target", () => {
    expect(formatCitationPaymentMemo("trust-infrastructure", "Dr. Elena Vasquez")).toBe(
      "citation:trust-infrastructure royalty-to:dr-elena-vasquez royalty-split",
    );
  });

  it("formats marketplace hello memo", () => {
    expect(formatMarketplaceHelloMemo()).toBe("marketplace:hello-demo x402-gateway");
  });

  it("truncates long memos", () => {
    const long = "a".repeat(200);
    expect(truncateMemo(long).length).toBeLessThanOrEqual(120);
  });
});