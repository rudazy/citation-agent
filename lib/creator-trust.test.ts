import { describe, expect, it } from "vitest";
import {
  formatTrustLabel,
  isDisplayableTrustScore,
  paidScoreToSignal,
  trustScoreToSignal,
} from "./creator-trust";

describe("creator-trust", () => {
  it("maps free trust to public signal with derived recommendation", () => {
    const signal = trustScoreToSignal({ score: 72, tier: "HIGH", confidence: 0.8 });
    expect(signal).toEqual({
      score: 72,
      tier: "HIGH",
      confidence: 0.8,
      recommendation: "INSTANT",
      source: "free",
    });
  });

  it("maps paid trust with recommendation", () => {
    const signal = paidScoreToSignal({
      score: 20,
      tier: "LOW",
      recommendation: "TIME_LOCKED",
    });
    expect(signal.source).toBe("paid");
    expect(signal.recommendation).toBe("TIME_LOCKED");
  });

  it("hides blocked zero scores from catalog display", () => {
    expect(trustScoreToSignal({ score: 0, tier: "BLOCKED", confidence: 0 })).toBeNull();
    expect(
      paidScoreToSignal({ score: 0, tier: "BLOCKED", recommendation: "BLOCKED" }),
    ).toBeNull();
    expect(isDisplayableTrustScore({ score: 92, tier: "HIGH" })).toBe(true);
  });

  it("formats trust label without wallet", () => {
    expect(
      formatTrustLabel({
        score: 20,
        tier: "LOW",
        confidence: 0,
        recommendation: "TIME_LOCKED",
        source: "paid",
      }),
    ).toBe("20 · LOW · TIME_LOCKED");
  });
});