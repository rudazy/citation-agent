import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ATTESTATION_ABI,
  ATTESTATION_PLATFORM_FEE_USDC,
  getAttestationAddress,
  getHistoricalAttestationAddresses,
  getIndexedAttestationAddresses,
  historicalDeployBlock,
  totalAttestationCostUsdc,
  totalAttestationCostUnits,
} from "./attestation";

const V1 = "0xc8886a68f2160a57a01b32aae542b6eec5ca3d02";
const V2 = "0x9b3716057b1da571658ed1A862865870bbcAc7c4";

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

describe("getAttestations ABI shape", () => {
  /**
   * The v2 stake record has 9 fields. Decoding it with 8 does NOT throw — viem
   * returns a short tuple and silently mislabels the trailing values, which
   * reads as plausible data until a stake is actually frozen. That failure mode
   * is invisible at runtime, so it is pinned here instead.
   */
  it("declares all nine stake fields in contract order", () => {
    const fn = ATTESTATION_ABI.find(
      (entry) => entry.type === "function" && entry.name === "getAttestations",
    );
    expect(fn).toBeDefined();

    const components = (
      fn as unknown as {
        outputs: [{ components: Array<{ name: string; type: string }> }];
      }
    ).outputs[0].components;

    expect(components.map((c) => c.name)).toEqual([
      "staker",
      "amount",
      "claim",
      "target",
      "timestamp",
      "unlockAt",
      "frozenAt",
      "firstFrozenAt",
      "status",
    ]);
    expect(components[components.length - 1].type).toBe("uint8");
  });

  it("keeps the Attested event identical to v1 so the indexer spans both", () => {
    const event = ATTESTATION_ABI.find(
      (entry) => entry.type === "event" && entry.name === "Attested",
    ) as unknown as { inputs: Array<{ name: string; type: string }> };

    expect(event.inputs.map((i) => i.name)).toEqual([
      "target",
      "staker",
      "claim",
      "amount",
      "platformFee",
    ]);
  });
});

describe("indexed attestation addresses", () => {
  const saved = {
    current: process.env.ATTESTATION_ADDRESS,
    publicCurrent: process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS,
    historical: process.env.ATTESTATION_V1_ADDRESS,
    block: process.env.ATTESTATION_V1_DEPLOY_BLOCK,
  };

  beforeEach(() => {
    delete process.env.ATTESTATION_ADDRESS;
    delete process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS;
    delete process.env.ATTESTATION_V1_ADDRESS;
    delete process.env.ATTESTATION_V1_DEPLOY_BLOCK;
  });

  afterEach(() => {
    for (const [key, value] of [
      ["ATTESTATION_ADDRESS", saved.current],
      ["NEXT_PUBLIC_ATTESTATION_ADDRESS", saved.publicCurrent],
      ["ATTESTATION_V1_ADDRESS", saved.historical],
      ["ATTESTATION_V1_DEPLOY_BLOCK", saved.block],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns only the current contract when no history is configured", () => {
    process.env.ATTESTATION_ADDRESS = V2;
    expect(getHistoricalAttestationAddresses()).toEqual([]);
    expect(getIndexedAttestationAddresses()).toEqual([V2]);
  });

  it("puts the current contract first, then history", () => {
    process.env.ATTESTATION_ADDRESS = V2;
    process.env.ATTESTATION_V1_ADDRESS = V1;
    expect(getIndexedAttestationAddresses()).toEqual([V2, V1]);
  });

  it("never double-counts a historical entry equal to the current contract", () => {
    process.env.ATTESTATION_ADDRESS = V2;
    // Different casing on purpose — addresses are compared case-insensitively.
    process.env.ATTESTATION_V1_ADDRESS = `${V1},${V2.toLowerCase()}`;
    expect(getIndexedAttestationAddresses()).toEqual([V2, V1]);
  });

  it("skips malformed entries instead of poisoning the query", () => {
    process.env.ATTESTATION_ADDRESS = V2;
    process.env.ATTESTATION_V1_ADDRESS = `not-an-address, 0x123 ,${V1}, `;
    expect(getIndexedAttestationAddresses()).toEqual([V2, V1]);
  });

  it("still returns history when the current contract is unset", () => {
    process.env.ATTESTATION_V1_ADDRESS = V1;
    expect(getAttestationAddress()).toBeNull();
    expect(getIndexedAttestationAddresses()).toEqual([V1]);
  });

  it("tolerates surrounding whitespace on the current address", () => {
    process.env.ATTESTATION_ADDRESS = `  ${V2}  `;
    expect(getAttestationAddress()).toBe(V2);
  });

  it("parses the historical deploy block and falls back to 0", () => {
    expect(historicalDeployBlock()).toBe(BigInt(0));
    process.env.ATTESTATION_V1_DEPLOY_BLOCK = "48323587";
    expect(historicalDeployBlock()).toBe(BigInt(48_323_587));
    process.env.ATTESTATION_V1_DEPLOY_BLOCK = "not-a-number";
    expect(historicalDeployBlock()).toBe(BigInt(0));
  });
});