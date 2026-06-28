import { describe, expect, it } from "vitest";
import {
  aggregateCitationLedgerStats,
  getCitationLedgerStats,
  getCreatorEarningsUsdc,
} from "./catalog-earnings-stats";

describe("aggregateCitationLedgerStats", () => {
  const now = new Date("2026-06-28T12:00:00Z");

  const rows = [
    {
      citation_id: "post-a",
      creator_wallet: "0xAAA",
      created_at: "2026-06-27T10:00:00Z",
      royalty_usdc: "1.5",
    },
    {
      citation_id: "post-a",
      creator_wallet: "0xAAA",
      created_at: "2026-06-20T10:00:00Z",
      royalty_usdc: "0.5",
    },
    {
      citation_id: "post-b",
      creator_wallet: "0xBBB",
      created_at: "2026-06-28T08:00:00Z",
      royalty_usdc: "2",
    },
    {
      citation_id: "post-b",
      creator_wallet: "0xBBB",
      created_at: "bad-date",
      royalty_usdc: "not-a-number",
    },
  ];

  it("counts all-time and 7-day readers per post", () => {
    const index = aggregateCitationLedgerStats(rows, { now });
    const a = getCitationLedgerStats(index, "post-a");
    const b = getCitationLedgerStats(index, "post-b");

    expect(a.allTimeReaders).toBe(2);
    expect(a.recentReaders7d).toBe(1);
    expect(b.allTimeReaders).toBe(2);
    expect(b.recentReaders7d).toBe(1);
  });

  it("sums post and creator earnings", () => {
    const index = aggregateCitationLedgerStats(rows, { now });
    expect(getCitationLedgerStats(index, "post-a").postEarningsUsdc).toBe(2);
    expect(getCitationLedgerStats(index, "post-b").postEarningsUsdc).toBe(2);
    expect(getCreatorEarningsUsdc(index, "0xAAA")).toBe(2);
    expect(getCreatorEarningsUsdc(index, "0xBBB")).toBe(2);
  });
});