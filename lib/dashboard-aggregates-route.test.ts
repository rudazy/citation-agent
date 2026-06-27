import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn() }));

import { getAdminClient } from "@/lib/supabase/admin";
import { GET as aggregatesGET } from "@/app/api/dashboard/aggregates/route";
import { GET as paymentsGET } from "@/app/api/dashboard/payment-events/route";

const ALLOWED_AGGREGATE_KEYS = new Set([
  "payments",
  "royalties",
  "agents",
  "totalVolumeUsdc",
  "paidToCreatorsUsdc",
]);

const FORBIDDEN_AGGREGATE_KEYS = [
  "events",
  "earnings",
  "rows",
  "payer",
  "wallet",
  "id",
  "created_at",
  "amount_usdc",
  "gateway_tx",
];

function mockAdminTotals() {
  vi.mocked(getAdminClient).mockReturnValue({
    from: (table: string) => {
      const count =
        table === "payment_events" ? 12 : table === "creator_earnings" ? 8 : 5;
      const builder = {
        select: (_cols?: string, opts?: { head?: boolean; count?: string }) => {
          if (opts?.head) {
            return Promise.resolve({ count, error: null });
          }
          const data =
            table === "payment_events"
              ? [{ amount_usdc: "1.5" }, { amount_usdc: "0.5" }]
              : [{ royalty_usdc: "1" }, { royalty_usdc: "0.25" }];
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  } as never);
}

describe("public dashboard aggregates route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminTotals();
  });

  it("returns 200 without operator auth and only aggregate totals", async () => {
    const res = await aggregatesGET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([...ALLOWED_AGGREGATE_KEYS].sort());

    for (const key of FORBIDDEN_AGGREGATE_KEYS) {
      expect(body).not.toHaveProperty(key);
    }

    expect(body.payments).toBe(12);
    expect(body.royalties).toBe(8);
    expect(body.agents).toBe(5);
    expect(body.totalVolumeUsdc).toBe("2");
    expect(body.paidToCreatorsUsdc).toBe("1.25");
  });

  it("raw payment-events ledger route still 403s without operator auth", async () => {
    const res = await paymentsGET(new Request("http://localhost/api/dashboard/payment-events"));
    expect(res.status).toBe(403);
  });
});