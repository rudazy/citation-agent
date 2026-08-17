import { describe, expect, it } from "vitest";
import {
  attestationTxKey,
  checksumStaker,
  dedupeIndexedAttestations,
} from "./attestation-claim-merge";
import type { MergeableAttestation } from "./attestation-claim-merge";

const TX =
  "0xba34029f697545d74d63b2906c73c79a26d7b089e0ab5ef5c71c5f599517c567" as const;
const STAKER_CHECKSUM = "0x9ABb95579c9d7ccf20AE1841115BdbE384E94826" as const;
const STAKER_LOWER = "0x9abb95579c9d7ccf20ae1841115bdbe384e94826" as const;

function row(
  partial: MergeableAttestation & { amountUsdc: string },
): MergeableAttestation & { amountUsdc: string } {
  return partial;
}

describe("attestationTxKey", () => {
  it("lowercases a mixed-case hash so Arcscan and the store collide", () => {
    const mixed = ("0x" + TX.slice(2).toUpperCase()) as `0x${string}`;
    expect(attestationTxKey(mixed)).toBe(TX);
    expect(attestationTxKey(TX)).toBe(TX);
  });

  it("returns null when there is no hash (on-chain fallback rows)", () => {
    expect(attestationTxKey(null)).toBeNull();
    expect(attestationTxKey(undefined)).toBeNull();
  });
});

describe("dedupeIndexedAttestations", () => {
  /**
   * Production pair from 2026-08-17 15:11: same tx, same amount, same wallet,
   * different staker casing. The UI showed this as two "2 USDC" rows and
   * doubled the target total. Both Arcscan links pointed at this hash.
   */
  it("collapses the live Quality-researcher duplicate into one stake", () => {
    const unique = dedupeIndexedAttestations([
      row({
        txHash: TX,
        staker: STAKER_CHECKSUM,
        amountUsdc: "2",
      }),
      row({
        txHash: TX,
        staker: STAKER_LOWER,
        amountUsdc: "2",
      }),
    ]);

    expect(unique).toHaveLength(1);
    expect(unique[0].txHash).toBe(TX);
    expect(unique[0].staker).toBe(STAKER_CHECKSUM);
    expect(unique[0].amountUsdc).toBe("2");
  });

  it("does not merge two different transactions of the same size", () => {
    const other =
      "0xb201f55e4b60754eabc9b8d0b8ebf347e47f35de8dd0c7f3818abcc1d3f3bbf7" as const;
    const unique = dedupeIndexedAttestations([
      row({ txHash: TX, staker: STAKER_CHECKSUM, amountUsdc: "2" }),
      row({ txHash: other, staker: STAKER_CHECKSUM, amountUsdc: "2" }),
    ]);
    expect(unique).toHaveLength(2);
  });

  it("keeps on-chain rows that have no tx hash", () => {
    const unique = dedupeIndexedAttestations([
      row({ txHash: null, staker: STAKER_LOWER, amountUsdc: "2" }),
      row({ txHash: TX, staker: STAKER_CHECKSUM, amountUsdc: "2" }),
    ]);
    expect(unique).toHaveLength(2);
  });
});

describe("checksumStaker", () => {
  it("normalizes mixed-case copies of the same wallet", () => {
    expect(checksumStaker(STAKER_LOWER)).toBe(STAKER_CHECKSUM);
    expect(checksumStaker(STAKER_CHECKSUM)).toBe(STAKER_CHECKSUM);
  });
});
