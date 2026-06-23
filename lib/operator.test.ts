import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { isOperatorAddress, operatorMessage, verifyOperatorRequest } from "./operator";

// Well-known test key (not used for any real funds).
const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const account = privateKeyToAccount(PRIVATE_KEY);

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/attestation/fees", { headers });
}

async function signedHeaders(timestamp: string, address = account.address) {
  const signature = await account.signMessage({ message: operatorMessage(timestamp) });
  return {
    "x-operator-address": address,
    "x-operator-timestamp": timestamp,
    "x-operator-signature": signature,
  };
}

describe("operator authorization", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_OPERATOR_ADDRESS = account.address;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_OPERATOR_ADDRESS;
  });

  it("matches the operator address case-insensitively", () => {
    expect(isOperatorAddress(account.address.toLowerCase())).toBe(true);
    expect(isOperatorAddress(account.address.toUpperCase().replace("0X", "0x"))).toBe(true);
    expect(isOperatorAddress("0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("accepts a fresh, valid operator signature", async () => {
    const headers = await signedHeaders(Date.now().toString());
    expect(await verifyOperatorRequest(requestWith(headers))).toBe(true);
  });

  it("rejects when the address is not the operator", async () => {
    process.env.NEXT_PUBLIC_OPERATOR_ADDRESS =
      "0x0000000000000000000000000000000000000002";
    const headers = await signedHeaders(Date.now().toString());
    expect(await verifyOperatorRequest(requestWith(headers))).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const headers = await signedHeaders(Date.now().toString());
    headers["x-operator-signature"] = headers["x-operator-signature"].replace(/.$/, "0");
    expect(await verifyOperatorRequest(requestWith(headers))).toBe(false);
  });

  it("rejects an expired timestamp", async () => {
    const stale = (Date.now() - 30 * 60 * 1000).toString();
    const headers = await signedHeaders(stale);
    expect(await verifyOperatorRequest(requestWith(headers))).toBe(false);
  });

  it("rejects when headers are missing", async () => {
    expect(await verifyOperatorRequest(requestWith({}))).toBe(false);
  });
});
