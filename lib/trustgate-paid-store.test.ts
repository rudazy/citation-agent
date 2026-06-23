import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPaidScoreCache } from "@/lib/trustgate-paid";

const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { getCachedPaidScore, setCachedPaidScore } from "@/lib/trustgate-paid-store";

describe("paid trust store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
      delete: mockDelete,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockUpsert.mockResolvedValue({ error: null });
  });

  afterEach(() => clearPaidScoreCache());

  it("returns memory cache without querying Supabase on read", async () => {
    await setCachedPaidScore("0xAbC0000000000000000000000000000000000001", {
      score: 12,
      tier: "LOW",
      recommendation: "OK",
    });
    mockFrom.mockClear();

    const hit = await getCachedPaidScore("0xabc0000000000000000000000000000000000001");
    expect(hit).toEqual({
      hit: true,
      value: { score: 12, tier: "LOW", recommendation: "OK" },
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("loads a valid row from Supabase and warms memory", async () => {
    const wallet = "0xabc0000000000000000000000000000000000002";
    mockMaybeSingle.mockResolvedValue({
      data: {
        score: 33,
        tier: "MID",
        recommendation: "WATCH",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    });

    const first = await getCachedPaidScore(wallet);
    expect(first.hit).toBe(true);
    expect(first.value).toEqual({ score: 33, tier: "MID", recommendation: "WATCH" });

    mockMaybeSingle.mockClear();
    const second = await getCachedPaidScore(wallet);
    expect(second.hit).toBe(true);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("ignores expired Supabase rows", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        score: 9,
        tier: "LOW",
        recommendation: "",
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
      error: null,
    });

    const hit = await getCachedPaidScore("0xabc0000000000000000000000000000000000003");
    expect(hit.hit).toBe(false);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("persists successful lookups to Supabase", async () => {
    await setCachedPaidScore("0xAbC0000000000000000000000000000000000004", {
      score: 77,
      tier: "HIGH",
      recommendation: "TRUST",
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet_address: "0xabc0000000000000000000000000000000000004",
        score: 77,
        tier: "HIGH",
        recommendation: "TRUST",
      }),
      { onConflict: "wallet_address" },
    );
  });
});