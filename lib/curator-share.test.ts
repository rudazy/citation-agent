import { describe, expect, it } from "vitest";
import {
  CURATOR_SHARE_RATES,
  computeCuratorShareUsdc,
  curatorRateLabel,
  formatCreditUsdc,
  summarizeCuratorCredit,
  type AttributionLedgerRow,
} from "@/lib/curator-share";

describe("computeCuratorShareUsdc", () => {
  it("pays the endorsement rate on a stamped post", () => {
    expect(computeCuratorShareUsdc("1.000000", "endorsement")).toBe("0.100000");
  });

  it("pays the lower referral rate on a bare link", () => {
    expect(computeCuratorShareUsdc("1.000000", "referral")).toBe("0.050000");
  });

  it("truncates rather than rounds so credit never exceeds gross", () => {
    // 0.001 * 0.05 = 0.00005 exactly; sub-unit remainders must floor.
    expect(computeCuratorShareUsdc("0.000019", "referral")).toBe("0.000000");
    const gross = 0.000019;
    expect(Number(computeCuratorShareUsdc(gross, "endorsement"))).toBeLessThanOrEqual(
      gross,
    );
  });

  it("credits the marketplace floor price", () => {
    expect(computeCuratorShareUsdc("0.001", "endorsement")).toBe("0.000100");
    expect(computeCuratorShareUsdc("0.001", "referral")).toBe("0.000050");
  });

  it("returns zero for non-positive or malformed amounts", () => {
    expect(computeCuratorShareUsdc("0", "endorsement")).toBe("0.000000");
    expect(computeCuratorShareUsdc("-5", "endorsement")).toBe("0.000000");
    expect(computeCuratorShareUsdc("not-a-number", "referral")).toBe("0.000000");
  });

  it("never exceeds the configured rate", () => {
    for (const gross of ["0.001", "0.5", "12.345678", "1000"]) {
      for (const source of ["endorsement", "referral"] as const) {
        const share = Number(computeCuratorShareUsdc(gross, source));
        expect(share).toBeLessThanOrEqual(
          Number(gross) * CURATOR_SHARE_RATES[source] + 1e-9,
        );
        expect(share).toBeLessThanOrEqual(Number(gross));
      }
    }
  });
});

describe("summarizeCuratorCredit", () => {
  const rows: AttributionLedgerRow[] = [
    { source: "endorsement", curator_share_usdc: "0.100000", settled_at: null },
    { source: "referral", curator_share_usdc: "0.050000", settled_at: null },
    {
      source: "endorsement",
      curator_share_usdc: "0.200000",
      settled_at: "2026-07-01T00:00:00Z",
    },
  ];

  it("splits pending credit from lifetime credit", () => {
    const summary = summarizeCuratorCredit(rows);
    expect(summary.pendingCreditUsdc).toBe("0.150000");
    expect(summary.totalCreditUsdc).toBe("0.350000");
  });

  it("counts unlocks by source", () => {
    const summary = summarizeCuratorCredit(rows);
    expect(summary.attributedUnlocks).toBe(3);
    expect(summary.endorsementUnlocks).toBe(2);
    expect(summary.referralUnlocks).toBe(1);
  });

  it("accepts numeric shares from the numeric ledger column", () => {
    const summary = summarizeCuratorCredit([
      { source: "referral", curator_share_usdc: 0.25, settled_at: null },
    ]);
    expect(summary.pendingCreditUsdc).toBe("0.250000");
  });

  it("skips unparseable shares without dropping the unlock count", () => {
    const summary = summarizeCuratorCredit([
      { source: "referral", curator_share_usdc: "oops", settled_at: null },
    ]);
    expect(summary.attributedUnlocks).toBe(1);
    expect(summary.totalCreditUsdc).toBe("0.000000");
  });

  it("returns zeroes for an empty ledger", () => {
    const summary = summarizeCuratorCredit([]);
    expect(summary.attributedUnlocks).toBe(0);
    expect(summary.pendingCreditUsdc).toBe("0.000000");
  });
});

describe("display helpers", () => {
  it("labels rates as whole percentages", () => {
    expect(curatorRateLabel("endorsement")).toBe("10%");
    expect(curatorRateLabel("referral")).toBe("5%");
  });

  it("trims trailing zeros from credit balances", () => {
    expect(formatCreditUsdc("0.150000")).toBe("0.15");
    expect(formatCreditUsdc("1.000000")).toBe("1");
    expect(formatCreditUsdc("0.000000")).toBe("0");
    expect(formatCreditUsdc("nope")).toBe("0");
  });
});
