import { describe, expect, it } from "vitest";
import { resolveUnlockPayee } from "./citations";
import type { CreatorContent } from "./citations";

const PAYOUT = "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function makeContent(overrides: Partial<CreatorContent>): CreatorContent {
  return {
    id: "post-1",
    title: "Test",
    author: "Creator",
    connectedWallet: PAYOUT,
    payoutWallet: PAYOUT,
    priceUsdc: "0.001",
    tags: [],
    subheading: "Public teaser for readers",
    body: "Paywalled body content",
    paidCount: 0,
    source: "database",
    ...overrides,
  };
}

describe("resolveUnlockPayee", () => {
  it("resolves to the post payout wallet for DB posts", () => {
    const content = makeContent({ source: "database", payoutWallet: PAYOUT });
    // Returned checksummed so it can be used directly as the x402 payee.
    expect(resolveUnlockPayee(content)).toBe(PAYOUT);
  });

  it("checksums a lowercased payout wallet", () => {
    const content = makeContent({
      payoutWallet: PAYOUT.toLowerCase() as `0x${string}`,
    });
    expect(resolveUnlockPayee(content)).toBe(PAYOUT);
  });

  it("returns null for legacy seeds with a zero payout wallet (SELLER_ADDRESS fallback)", () => {
    const content = makeContent({ source: "markdown", payoutWallet: ZERO });
    expect(resolveUnlockPayee(content)).toBeNull();
  });

  it("returns null when the payout wallet is missing or malformed", () => {
    expect(
      resolveUnlockPayee(
        makeContent({ payoutWallet: "" as `0x${string}` }),
      ),
    ).toBeNull();
    expect(
      resolveUnlockPayee(
        makeContent({ payoutWallet: "0xnope" as `0x${string}` }),
      ),
    ).toBeNull();
  });
});
