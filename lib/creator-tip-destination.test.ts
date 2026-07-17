import { describe, expect, it } from "vitest";
import { preferredTipWallet } from "@/lib/creator-tip";

const TIP = "0x4444444444444444444444444444444444444444" as const;
const PAYOUT = "0x5555555555555555555555555555555555555555" as const;

describe("preferredTipWallet", () => {
  it("uses the tip override when set", () => {
    expect(preferredTipWallet(TIP, PAYOUT)).toBe(TIP);
    expect(preferredTipWallet(TIP, null)).toBe(TIP);
  });

  it("falls back to the payout wallet when no override (cleared state)", () => {
    expect(preferredTipWallet(null, PAYOUT)).toBe(PAYOUT);
  });

  it("returns null when neither is configured (resolver keeps falling back)", () => {
    expect(preferredTipWallet(null, null)).toBeNull();
  });
});
