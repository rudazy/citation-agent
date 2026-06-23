import { describe, expect, it } from "vitest";
import {
  authorBackingTarget,
  formatBackingHint,
  formatResearcherBackingHint,
  reportBackingTarget,
  summarizeBackingRow,
} from "./research-backing";
import type { TargetSummary } from "./attestation-index";

function row(partial: Partial<TargetSummary> & Pick<TargetSummary, "target">): TargetSummary {
  return {
    label: partial.target,
    kind: "other",
    totalUsdc: "0",
    claimCount: 0,
    backerCount: 0,
    trustWeightedUsdc: "0",
    unscoredStakers: 0,
    ...partial,
  };
}

describe("research-backing", () => {
  it("canonicalizes author and report targets", () => {
    expect(authorBackingTarget("Onchain Alpha Desk")).toBe("author:Onchain Alpha Desk");
    expect(reportBackingTarget("hyperliquid-market-share")).toBe(
      "citation:hyperliquid-market-share",
    );
  });

  it("formats subtle backing hints", () => {
    const stats = summarizeBackingRow(
      row({ target: "author:Alice", totalUsdc: "1.5", backerCount: 2, claimCount: 3 }),
    );
    expect(formatBackingHint(stats)).toBe("2 backers · 1.5 USDC");
    expect(formatResearcherBackingHint(stats)).toBe("2 backers · 1.5 USDC behind researcher");
  });

  it("returns null when no backers", () => {
    expect(summarizeBackingRow(row({ target: "author:Bob", totalUsdc: "0", backerCount: 0 }))).toBeNull();
    expect(formatBackingHint(null)).toBeNull();
  });
});