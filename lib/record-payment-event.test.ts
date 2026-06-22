import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(),
}));

import { getAdminClient } from "@/lib/supabase/admin";
import { recordPaymentEvent } from "./record-payment-event";

describe("recordPaymentEvent", () => {
  it("returns false when admin client is missing", async () => {
    vi.mocked(getAdminClient).mockReturnValue(null);
    const ok = await recordPaymentEvent({
      endpoint: "/api/marketplace/hello",
      payer: "0xabc",
      amount_usdc: "0.01",
      network: "eip155:5042002",
      gateway_tx: "settlement-1",
    });
    expect(ok).toBe(false);
  });

  it("returns true on successful insert", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getAdminClient).mockReturnValue({
      from: () => ({ insert }),
    } as never);

    const ok = await recordPaymentEvent({
      endpoint: "/api/marketplace/hello",
      payer: "0xabc",
      amount_usdc: "0.01",
      network: "eip155:5042002",
      gateway_tx: "settlement-1",
      payment_memo: "hello",
    });

    expect(ok).toBe(true);
    expect(insert).toHaveBeenCalled();
  });
});