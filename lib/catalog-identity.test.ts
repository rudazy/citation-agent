import { afterEach, describe, expect, it } from "vitest";
import type { CreatorContent } from "@/lib/citations";
import {
  marketplaceIdentityWallet,
  resolvePublisherTrustWallet,
  resolveTrustIdentityWallet,
} from "./catalog-identity";

const OPERATOR = "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62" as const;
const SEED_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const;
const DB_WALLET = "0x33e27d6dc287B1EA58865DDD9cF9460a53224134" as const;
const DB_PAYOUT = "0x9bb03b996aafa88ad997cc14f6de5b1ea44a60d2" as const;

function makeItem(
  partial: Pick<CreatorContent, "source" | "connectedWallet"> & {
    payoutWallet?: `0x${string}`;
  },
): CreatorContent {
  return {
    id: "test-post",
    title: "Test",
    author: "Author",
    connectedWallet: partial.connectedWallet,
    payoutWallet: partial.payoutWallet ?? partial.connectedWallet,
    priceUsdc: "0.001",
    tags: [],
    subheading: "Teaser",
    body: "Body",
    paidCount: 0,
    source: partial.source,
  };
}

describe("catalog-identity", () => {
  afterEach(() => {
    delete process.env.MARKETPLACE_IDENTITY_WALLET;
    delete process.env.NEXT_PUBLIC_OPERATOR_ADDRESS;
  });

  it("uses signing wallet for database posts even when payout differs", () => {
    const item = makeItem({
      source: "database",
      connectedWallet: DB_WALLET,
      payoutWallet: DB_PAYOUT,
    });
    expect(resolvePublisherTrustWallet(item)).toBe(DB_WALLET);
    expect(resolveTrustIdentityWallet(item)).toBe(DB_WALLET);
  });

  it("uses operator wallet for markdown seeds when configured", () => {
    process.env.NEXT_PUBLIC_OPERATOR_ADDRESS = OPERATOR;
    const item = makeItem({ source: "markdown", connectedWallet: SEED_WALLET });
    expect(resolveTrustIdentityWallet(item)).toBe(OPERATOR);
  });

  it("prefers MARKETPLACE_IDENTITY_WALLET over operator", () => {
    process.env.NEXT_PUBLIC_OPERATOR_ADDRESS = OPERATOR;
    process.env.MARKETPLACE_IDENTITY_WALLET = DB_WALLET;
    const item = makeItem({ source: "markdown", connectedWallet: SEED_WALLET });
    expect(resolveTrustIdentityWallet(item)).toBe(DB_WALLET);
  });

  it("falls back to seed author_wallet when no operator is set", () => {
    const item = makeItem({ source: "markdown", connectedWallet: SEED_WALLET });
    expect(resolveTrustIdentityWallet(item)).toBe(SEED_WALLET);
    expect(marketplaceIdentityWallet()).toBeNull();
  });
});