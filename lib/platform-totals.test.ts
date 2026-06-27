import { describe, expect, it } from "vitest";
import { sumUsdcAmounts } from "./platform-totals";

describe("sumUsdcAmounts", () => {
  it("sums valid USDC strings and ignores invalid values", () => {
    expect(sumUsdcAmounts(["1", "0.5", "2.25"])).toBeCloseTo(3.75, 6);
    expect(sumUsdcAmounts(["1", "not-a-number", "2"])).toBeCloseTo(3, 6);
    expect(sumUsdcAmounts([])).toBe(0);
  });
});