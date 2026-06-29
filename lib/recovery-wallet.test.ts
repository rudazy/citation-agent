import { describe, expect, it } from "vitest";
import { parseRecoveryWallet } from "./recovery-wallet";

describe("parseRecoveryWallet", () => {
  it("accepts checksummed addresses", () => {
    expect(parseRecoveryWallet("0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62")).toBe(
      "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62",
    );
  });

  it("rejects invalid input", () => {
    expect(parseRecoveryWallet("not-a-wallet")).toBeNull();
    expect(parseRecoveryWallet("")).toBeNull();
    expect(parseRecoveryWallet(undefined)).toBeNull();
  });
});