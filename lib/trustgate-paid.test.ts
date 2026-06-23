import { afterEach, describe, expect, it } from "vitest";
import {
  buildPaymentProof,
  clearPaidScoreCache,
  encodePaymentHeader,
  getCachedPaidScore,
  parseOracleChallenge,
  parseOracleScore,
  setCachedPaidScore,
} from "./trustgate-paid";

function decodeHeader(header: string): unknown {
  return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
}

describe("payment proof builder", () => {
  it("builds the X-PAYMENT payload shape and encodes it as base64 JSON", () => {
    const proof = buildPaymentProof({
      txHash: "0xpaymenttx",
      from: "0xfrom",
      network: "arc-testnet",
      nonce: "0xnonce",
    });
    expect(proof).toEqual({
      txHash: "0xpaymenttx",
      nonce: "0xnonce",
      from: "0xfrom",
      network: "arc-testnet",
    });
    expect(decodeHeader(encodePaymentHeader(proof))).toEqual(proof);
  });

  it("generates a random nonce when none is supplied", () => {
    const proof = buildPaymentProof({ txHash: "0x1", from: "0x2", network: "arc-testnet" });
    expect(proof.nonce.length).toBeGreaterThan(0);
  });

  it("includes challenge payment fields in the proof envelope", () => {
    const proof = buildPaymentProof({
      txHash: "0xpay",
      from: "0xfrom",
      network: "arc-testnet",
      challenge: {
        recipient: "0x52E17bC482d00776d73811680CbA9914e83E33CC",
        amount: "0.001",
        chainId: 5042002,
        network: "arc-testnet",
      },
      nonce: "nonce-1",
    });
    expect(proof).toMatchObject({
      amount: "0.001",
      currency: "USDC",
      chainId: 5042002,
      recipient: "0x52E17bC482d00776d73811680CbA9914e83E33CC",
    });
  });
});

describe("parseOracleScore", () => {
  it("requires a numeric score and keeps tier and recommendation only", () => {
    expect(
      parseOracleScore({
        score: 20,
        tier: "LOW",
        recommendation: "TIME_LOCKED",
        breakdown: { txPoints: 20 },
      }),
    ).toEqual({ score: 20, tier: "LOW", recommendation: "TIME_LOCKED" });
  });

  it("defaults tier to empty and derives recommendation from score", () => {
    expect(parseOracleScore({ score: 5 })).toEqual({
      score: 5,
      tier: "",
      recommendation: "TIME_LOCKED",
    });
  });

  it("coerces string scores and derives recommendation when omitted", () => {
    expect(parseOracleScore({ score: "57", tier: "MEDIUM" })).toEqual({
      score: 57,
      tier: "MEDIUM",
      recommendation: "TIME_LOCKED",
    });
  });

  it("returns null for a missing score or malformed body", () => {
    expect(parseOracleScore({ tier: "LOW" })).toBeNull();
    expect(parseOracleScore(null)).toBeNull();
    expect(parseOracleScore("nope")).toBeNull();
  });
});

describe("parseOracleChallenge", () => {
  const valid = {
    error: "Payment required",
    amount: "0.001",
    currency: "USDC",
    network: "arc-testnet",
    chainId: 5042002,
    recipient: "0x52E17bC482d00776d73811680CbA9914e83E33CC",
  };

  it("reads recipient, amount, chainId, network from the 402 body", () => {
    expect(parseOracleChallenge(valid)).toEqual({
      recipient: "0x52E17bC482d00776d73811680CbA9914e83E33CC",
      amount: "0.001",
      chainId: 5042002,
      network: "arc-testnet",
    });
  });

  it("returns null when recipient or amount is invalid", () => {
    expect(parseOracleChallenge({ ...valid, recipient: "nope" })).toBeNull();
    expect(parseOracleChallenge({ ...valid, amount: "0" })).toBeNull();
  });
});

describe("paid score cache", () => {
  afterEach(() => clearPaidScoreCache());

  it("returns a cached score within TTL so a repeat lookup does not re-charge", () => {
    const addr = "0xAbC0000000000000000000000000000000000001";
    expect(getCachedPaidScore(addr).hit).toBe(false);

    setCachedPaidScore(addr, { score: 42, tier: "MID", recommendation: "OK" });

    const hit = getCachedPaidScore(addr.toLowerCase());
    expect(hit.hit).toBe(true);
    expect(hit.value).toEqual({ score: 42, tier: "MID", recommendation: "OK" });
  });

  it("caches nulls (failures) too, distinguishable from a miss", () => {
    const addr = "0xAbC0000000000000000000000000000000000002";
    setCachedPaidScore(addr, null);
    const hit = getCachedPaidScore(addr);
    expect(hit.hit).toBe(true);
    expect(hit.value).toBeNull();
  });
});
