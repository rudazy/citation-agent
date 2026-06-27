import { describe, expect, it } from "vitest";
import {
  countRealCreators,
  formatUsdc,
  isRealExternalCreator,
  summarizeSinceLaunch,
} from "./marketplace-metrics";

const CAMPAIGN_START = new Date("2026-06-28T00:00:00Z");

describe("summarizeSinceLaunch (campaign-start filter)", () => {
  const rows = [
    { created_at: "2026-06-27T23:59:59Z", royalty_usdc: "5" }, // before launch -> excluded
    { created_at: "2026-06-28T00:00:00Z", royalty_usdc: "1" }, // exactly at launch -> included
    { created_at: "2026-06-28T09:00:00Z", royalty_usdc: "0.5" }, // after launch -> included
    { created_at: "2026-06-29T00:00:00Z", royalty_usdc: "2" }, // after launch -> included
  ];

  it("excludes rows before the campaign start", () => {
    const { unlocksSinceLaunch, paidToCreators } = summarizeSinceLaunch(rows, CAMPAIGN_START);
    // Only the 3 at/after launch count; the pre-launch 5 USDC row is excluded.
    expect(unlocksSinceLaunch).toBe(3);
    expect(paidToCreators).toBeCloseTo(3.5, 6);
  });

  it("includes a row whose timestamp equals the campaign start (inclusive boundary)", () => {
    const boundaryOnly = summarizeSinceLaunch(
      [{ created_at: "2026-06-28T00:00:00Z", royalty_usdc: "1" }],
      CAMPAIGN_START,
    );
    expect(boundaryOnly.unlocksSinceLaunch).toBe(1);
    expect(boundaryOnly.paidToCreators).toBeCloseTo(1, 6);
  });

  it("returns zeros when every row predates launch", () => {
    const allBefore = summarizeSinceLaunch(
      [
        { created_at: "2026-06-01T00:00:00Z", royalty_usdc: "1" },
        { created_at: "2026-06-27T23:59:59Z", royalty_usdc: "2" },
      ],
      CAMPAIGN_START,
    );
    expect(allBefore.unlocksSinceLaunch).toBe(0);
    expect(allBefore.paidToCreators).toBe(0);
  });

  it("ignores rows with unparseable royalty or timestamp", () => {
    const messy = summarizeSinceLaunch(
      [
        { created_at: "not-a-date", royalty_usdc: "1" }, // bad timestamp -> excluded
        { created_at: "2026-06-28T01:00:00Z", royalty_usdc: "abc" }, // counted, royalty 0
      ],
      CAMPAIGN_START,
    );
    expect(messy.unlocksSinceLaunch).toBe(1);
    expect(messy.paidToCreators).toBe(0);
  });
});

describe("countRealCreators (real external creators only)", () => {
  const catalog = [
    { author: "Crypto Allen", connectedWallet: "0xcbde65f69574c94f0c3ba7927e3d5eb7d921ffed" },
    { author: "Crypto Allen", connectedWallet: "0x1cbad6693df7211ae1488f4eaba2579c7d332250" }, // same creator, 2nd wallet
    { author: "Vickman", connectedWallet: "0x1eef8295a36be966d845a040c610c502d41cc78b" },
    { author: "DeFiqueen", connectedWallet: "0x83f2f182499753677e77ea8738ddf1ed6e509d5e" },
    { author: "Creator 0x7d30...ad95", connectedWallet: "0x7d303d02666a1b037cf8f5a74d92833428e7ad95" },
    // Citation Team seeds on the seed wallet -> excluded:
    { author: "Citation Team", connectedWallet: "0x60c05e2d820ce989e944ed4e7bb33baeb8705c62" },
    { author: "Citation Team", connectedWallet: "0x60c05e2d820ce989e944ed4e7bb33baeb8705c62" },
  ];

  it("counts the 4 real creators and excludes Citation Team", () => {
    expect(countRealCreators(catalog)).toBe(4);
  });

  it("collapses one creator using multiple wallets into a single count", () => {
    const dup = [
      { author: "Crypto Allen", connectedWallet: "0xaaa0000000000000000000000000000000000001" },
      { author: "crypto allen", connectedWallet: "0xaaa0000000000000000000000000000000000002" },
    ];
    expect(countRealCreators(dup)).toBe(1);
  });

  it("excludes posts published on a known seed wallet even if not named Citation Team", () => {
    expect(
      isRealExternalCreator({
        author: "Some Persona",
        connectedWallet: "0x0f293d22dee9fccfc13ce095a2c1d4293a670449",
      }),
    ).toBe(false);
    // Operator's own test publisher wallet (default-named) must not count.
    expect(
      isRealExternalCreator({
        author: "Creator 0x0965...8804",
        connectedWallet: "0x0965ee2065884321b8b12d269925785a56b98804",
      }),
    ).toBe(false);
  });
});

describe("formatUsdc", () => {
  it("trims trailing zeros and handles zero/negative", () => {
    expect(formatUsdc(3.5)).toBe("3.5");
    expect(formatUsdc(1)).toBe("1");
    expect(formatUsdc(0.001)).toBe("0.001");
    expect(formatUsdc(0)).toBe("0");
    expect(formatUsdc(-2)).toBe("0");
  });
});
