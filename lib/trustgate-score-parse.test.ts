import { describe, expect, it } from "vitest";
import {
  coerceTrustScore,
  deriveWalletRecommendation,
  normalizeTrustScore,
} from "./trustgate-score-parse";

describe("trustgate-score-parse", () => {
  it("coerces numeric strings", () => {
    expect(coerceTrustScore("92")).toBe(92);
    expect(coerceTrustScore(57)).toBe(57);
    expect(coerceTrustScore("nope")).toBeNull();
  });

  it("truncates fractional scores to integers", () => {
    expect(normalizeTrustScore(72.9)).toBe(72);
  });

  it("derives wallet recommendations from score bands", () => {
    expect(deriveWalletRecommendation(0)).toBe("BLOCKED");
    expect(deriveWalletRecommendation(40)).toBe("TIME_LOCKED");
    expect(deriveWalletRecommendation(72)).toBe("INSTANT");
    expect(deriveWalletRecommendation(92)).toBe("INSTANT_PRIORITY");
  });
});