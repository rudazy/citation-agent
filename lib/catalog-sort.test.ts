import { describe, expect, it } from "vitest";
import { sortCatalogListings } from "./catalog-sort";

const base = {
  paid_count: 0,
  recent_readers_7d: 0,
  creator_earnings_usdc: 0,
  post_earnings_usdc: 0,
};

describe("sortCatalogListings", () => {
  it("sorts latest by published_at descending", () => {
    const rows = [
      { ...base, id: "old", published_at: "2026-01-01T00:00:00Z" },
      { ...base, id: "new", published_at: "2026-06-28T00:00:00Z" },
      { ...base, id: "seed" },
    ];
    expect(sortCatalogListings(rows, "latest").map((r) => r.id)).toEqual([
      "new",
      "old",
      "seed",
    ]);
  });

  it("sorts by readers descending", () => {
    const rows = [
      { ...base, id: "z-report", paid_count: 2 },
      { ...base, id: "a-report", paid_count: 5 },
      { ...base, id: "m-report", paid_count: 5 },
      { ...base, id: "b-report", paid_count: 0 },
    ];
    expect(sortCatalogListings(rows, "readers").map((r) => r.id)).toEqual([
      "a-report",
      "m-report",
      "z-report",
      "b-report",
    ]);
  });

  it("sorts trending by recent 7-day readers", () => {
    const rows = [
      { ...base, id: "a", paid_count: 10, recent_readers_7d: 1 },
      { ...base, id: "b", paid_count: 2, recent_readers_7d: 5 },
      { ...base, id: "c", paid_count: 0, recent_readers_7d: 5 },
    ];
    expect(sortCatalogListings(rows, "trending").map((r) => r.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("sorts earning by creator total then post earnings", () => {
    const rows = [
      {
        ...base,
        id: "low-creator-low-post",
        creator_earnings_usdc: 1,
        post_earnings_usdc: 0.5,
      },
      {
        ...base,
        id: "top-creator-mid-post",
        creator_earnings_usdc: 10,
        post_earnings_usdc: 3,
      },
      {
        ...base,
        id: "top-creator-high-post",
        creator_earnings_usdc: 10,
        post_earnings_usdc: 7,
      },
    ];
    expect(sortCatalogListings(rows, "earning").map((r) => r.id)).toEqual([
      "top-creator-high-post",
      "top-creator-mid-post",
      "low-creator-low-post",
    ]);
  });
});