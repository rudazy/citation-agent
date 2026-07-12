import { describe, expect, it } from "vitest";
import {
  formatTipPrice,
  MIN_TIP_USDC,
  parseTipAmountUsdc,
} from "@/lib/creator-tip";

describe("creator-tip", () => {
  it("parses valid tip amounts", () => {
    expect(parseTipAmountUsdc("0.1")).toBe(0.1);
    expect(parseTipAmountUsdc("1")).toBe(1);
    expect(parseTipAmountUsdc(String(MIN_TIP_USDC))).toBe(MIN_TIP_USDC);
  });

  it("rejects invalid or out-of-range tips", () => {
    expect(parseTipAmountUsdc("0")).toBeNull();
    expect(parseTipAmountUsdc("0.0001")).toBeNull();
    expect(parseTipAmountUsdc("1001")).toBeNull();
    expect(parseTipAmountUsdc("nope")).toBeNull();
  });

  it("formats x402 price strings", () => {
    expect(formatTipPrice(0.1)).toBe("$0.1");
    expect(formatTipPrice(1)).toBe("$1");
  });
});
