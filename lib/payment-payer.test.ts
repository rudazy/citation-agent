import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_PAYER } from "./payment-payer";

describe("payment-payer", () => {
  it("defaults to agent wallet for all micropayments", () => {
    expect(DEFAULT_PAYMENT_PAYER).toBe("agent");
  });
});