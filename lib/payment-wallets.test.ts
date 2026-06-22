import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getSellerAddress, sellerConfigError } from "./payment-wallets";

describe("payment-wallets", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env = original;
  });

  it("requires a seller address distinct from the buyer", () => {
    process.env.BUYER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    process.env.BUYER_PRIVATE_KEY =
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603a7ebfcecf";
    delete process.env.SELLER_ADDRESS;
    expect(getSellerAddress()).toBeNull();
    expect(sellerConfigError()).toContain("SELLER_ADDRESS not configured");

    process.env.SELLER_ADDRESS = process.env.BUYER_ADDRESS;
    expect(sellerConfigError()).toContain("must differ");
  });

  it("returns null seller when unset", () => {
    delete process.env.SELLER_ADDRESS;
    expect(getSellerAddress()).toBeNull();
  });
});