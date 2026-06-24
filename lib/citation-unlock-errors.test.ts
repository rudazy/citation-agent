import { describe, expect, it } from "vitest";
import {
  gatewayDepositPromptMessage,
  isInsufficientGatewayBalance,
  suggestGatewayDepositAmount,
} from "./citation-unlock-errors";

describe("isInsufficientGatewayBalance", () => {
  it("detects Circle facilitator insufficient_balance", () => {
    expect(isInsufficientGatewayBalance("insufficient_balance")).toBe(true);
  });

  it("detects settlement failure messages", () => {
    expect(isInsufficientGatewayBalance("Payment settlement failed")).toBe(true);
    expect(
      isInsufficientGatewayBalance("Payment failed: Payment settlement failed"),
    ).toBe(true);
  });

  it("does not treat empty wallet as gateway balance issue", () => {
    expect(
      isInsufficientGatewayBalance(
        "Agent wallet has no USDC to deposit. Fund 0xabc via Circle faucet first.",
      ),
    ).toBe(false);
    expect(
      isInsufficientGatewayBalance("Insufficient wallet USDC. Have 0, need 1"),
    ).toBe(false);
  });

  it("does not treat unrelated errors as gateway balance", () => {
    expect(isInsufficientGatewayBalance("User rejected the request")).toBe(false);
    expect(isInsufficientGatewayBalance("Wrong network")).toBe(false);
  });
});

describe("suggestGatewayDepositAmount", () => {
  it("uses floor when price is below minimum", () => {
    expect(suggestGatewayDepositAmount("0.001", "1")).toBe("1");
  });

  it("covers report price when above floor", () => {
    expect(suggestGatewayDepositAmount("5", "1")).toBe("5");
    expect(suggestGatewayDepositAmount("1.25", "1")).toBe("1.25");
  });
});

describe("gatewayDepositPromptMessage", () => {
  it("uses plain language without Gateway jargon", () => {
    const msg = gatewayDepositPromptMessage("1", "1");
    expect(msg).toContain("payment balance");
    expect(msg).not.toContain("Circle Gateway");
    expect(msg).toContain("Deposit 1 USDC");
  });
});

describe("insufficient balance triggers deposit prompt path", () => {
  it("maps facilitator reason to deposit suggestion", () => {
    const reason = "insufficient_balance";
    expect(isInsufficientGatewayBalance(reason)).toBe(true);
    const amount = suggestGatewayDepositAmount("3", "1");
    expect(amount).toBe("3");
    expect(gatewayDepositPromptMessage(amount, "3")).toContain("Deposit 3 USDC");
  });
});