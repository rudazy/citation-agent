import { describe, expect, it } from "vitest";
import {
  ATTESTATION_PLATFORM_FEE_USDC,
  totalAttestationCostUsdc,
  totalAttestationCostUnits,
} from "./attestation";

describe("attestation platform fee", () => {
  it("charges flat 0.1 USDC on top of stake", () => {
    expect(totalAttestationCostUsdc(0.1)).toBe(0.2);
    expect(totalAttestationCostUsdc(20)).toBe(20.1);
    expect(totalAttestationCostUnits(BigInt(100_000))).toBe(BigInt(200_000));
  });

  it("exposes constant platform fee", () => {
    expect(ATTESTATION_PLATFORM_FEE_USDC).toBe(0.1);
  });
});