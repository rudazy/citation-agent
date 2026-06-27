import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Mock the service-role admin client so the routes never touch a real database.
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn() }));

import { getAdminClient } from "@/lib/supabase/admin";
import { GET as earningsGET } from "@/app/api/dashboard/creator-earnings/route";
import { GET as paymentsGET } from "@/app/api/dashboard/payment-events/route";
import { GET as reputationGET } from "@/app/api/dashboard/agent-reputation/route";

// Operator identity used by verifyOperatorRequest (read from env at request time).
const operator = privateKeyToAccount(generatePrivateKey());
process.env.NEXT_PUBLIC_OPERATOR_ADDRESS = operator.address;

const ROUTES = [
  { name: "creator-earnings", GET: earningsGET, key: "earnings" },
  { name: "payment-events", GET: paymentsGET, key: "events" },
  { name: "agent-reputation", GET: reputationGET, key: "agents" },
] as const;

/**
 * Stub admin client supporting the two query shapes this test exercises:
 *  - ledger routes: from(table).select(...).order(...)  -> fixed rows
 *  - replay store:  from("used_auth_signatures").select(...).eq(...).maybeSingle()
 *                   and .insert(...)                     -> empty / success
 */
function mockLedger(rows: unknown[]) {
  vi.mocked(getAdminClient).mockReturnValue({
    from: () => {
      const builder = {
        select: () => builder,
        order: () => Promise.resolve({ data: rows, error: null }),
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        insert: () => Promise.resolve({ error: null }),
        delete: () => builder,
      };
      return builder;
    },
  } as never);
}

/** Fresh, valid operator headers. tsOffset keeps signatures unique per call. */
async function operatorHeaders(tsOffset = 0): Promise<Record<string, string>> {
  const timestamp = (Date.now() + tsOffset).toString();
  const signature = await operator.signMessage({
    message: `TrustGate operator access ${timestamp}`,
  });
  return {
    "x-operator-address": operator.address,
    "x-operator-timestamp": timestamp,
    "x-operator-signature": signature,
  };
}

function request(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/dashboard/test", { headers });
}

describe("operator-gated dashboard ledger routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLedger([{ id: "row-1" }]);
  });

  for (const route of ROUTES) {
    it(`${route.name}: 403 without an operator signature`, async () => {
      const res = await route.GET(request());
      expect(res.status).toBe(403);
      expect(getAdminClient).not.toHaveBeenCalled();
    });

    it(`${route.name}: 403 with a non-operator signature`, async () => {
      const impostor = privateKeyToAccount(generatePrivateKey());
      const timestamp = Date.now().toString();
      const signature = await impostor.signMessage({
        message: `TrustGate operator access ${timestamp}`,
      });
      const res = await route.GET(
        request({
          "x-operator-address": impostor.address,
          "x-operator-timestamp": timestamp,
          "x-operator-signature": signature,
        }),
      );
      expect(res.status).toBe(403);
    });

    it(`${route.name}: 200 with a valid operator signature`, async () => {
      const res = await route.GET(request(await operatorHeaders()));
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown[]>;
      expect(body[route.key]).toEqual([{ id: "row-1" }]);
    });
  }

  it("rejects a replayed operator signature", async () => {
    const headers = await operatorHeaders();
    const first = await earningsGET(request(headers));
    expect(first.status).toBe(200);
    // Same signature reused: replay store must reject it.
    const second = await earningsGET(request(headers));
    expect(second.status).toBe(403);
  });
});
