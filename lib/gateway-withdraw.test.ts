import { describe, expect, it } from "vitest";
import {
  formatWithdrawError,
  isSupportedWithdrawChain,
  WITHDRAW_CHAIN_LABELS,
} from "./gateway-withdraw";

describe("isSupportedWithdrawChain", () => {
  it("accepts Arc testnet", () => {
    expect(isSupportedWithdrawChain("arcTestnet")).toBe(true);
  });

  it("rejects unknown chains", () => {
    expect(isSupportedWithdrawChain("mainnet")).toBe(false);
  });
});

describe("formatWithdrawError", () => {
  const wallet = "0x1234567890123456789012345678901234567890";

  it("maps Arc gas errors to faucet guidance", () => {
    const msg = formatWithdrawError(
      "insufficient funds for gas",
      wallet,
      "arcTestnet",
    );
    expect(msg).toContain("native USDC on Arc");
    expect(msg).toContain("faucet.circle.com");
  });

  it("maps cross-chain gas errors to destination chain label", () => {
    const msg = formatWithdrawError(
      "gas required exceeds allowance",
      wallet,
      "baseSepolia",
    );
    expect(msg).toContain(WITHDRAW_CHAIN_LABELS.baseSepolia);
    expect(msg).toContain("native gas");
  });

  it("returns raw message when unrecognized", () => {
    expect(formatWithdrawError("custom failure", wallet, "arcTestnet")).toBe(
      "custom failure",
    );
  });
});