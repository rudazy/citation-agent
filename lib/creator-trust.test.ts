import { describe, expect, it } from "vitest";
import {
  formatTrustLabel,
  paidScoreToSignal,
  trustScoreToSignal,
} from "./creator-trust";

describe("creator-trust", () => {
  it("maps free trust to public signal", () => {
    const signal = trustScoreToSignal({ score: 72.4, tier: "MEDIUM", confidence: 0.8 });
    expect(signal).toEqual({
      score: 72,
      tier: "MEDIUM",
      confidence: 0.8,
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

  it("formats trust label without wallet", () => {
    expect(
      formatTrustLabel({
        score: 20,
        tier: "LOW",
        confidence: 0,
        recommendation: "TIME_LOCKED",
        source: "paid",
      }),
    ).toBe("TrustGate 20 · LOW · TIME_LOCKED");
  });
});