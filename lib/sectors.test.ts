import { describe, expect, it } from "vitest";
import {
  SECTOR_LABELS,
  buildSectorFacets,
  sectorForPost,
  sectorForTag,
} from "@/lib/sectors";

describe("sectorForTag", () => {
  it("maps well-known crypto tags to sectors", () => {
    expect(sectorForTag("solana")).toBe("l1-l2");
    expect(sectorForTag("ethereum")).toBe("l1-l2");
    expect(sectorForTag("lending")).toBe("defi");
    expect(sectorForTag("stablecoin")).toBe("stablecoins");
    expect(sectorForTag("oracle")).toBe("infrastructure");
    expect(sectorForTag("nft")).toBe("nft-gaming");
    expect(sectorForTag("dao")).toBe("governance");
  });

  it("matches per token and is case-insensitive", () => {
    expect(sectorForTag("Ethereum-L2")).toBe("l1-l2");
    expect(sectorForTag("  PERPS  ")).toBe("defi");
    expect(sectorForTag("liquid staking")).toBe("defi");
  });

  it("tolerates simple plurals", () => {
    expect(sectorForTag("stablecoins")).toBe("stablecoins");
    expect(sectorForTag("rollups")).toBe("l1-l2");
    expect(sectorForTag("payments")).toBe("stablecoins");
  });

  // Regression: naive substring matching filed these under the wrong sector
  // because short keywords ("da", "ai", "dex") appear inside unrelated words.
  it("does not match keywords hidden inside longer words", () => {
    expect(sectorForTag("dao")).toBe("governance");
    expect(sectorForTag("blockchain")).not.toBe("ai-agents");
    expect(sectorForTag("indexer")).toBe("infrastructure");
    expect(sectorForTag("gamma")).not.toBe("defi");
  });

  it("matches multi-word keywords against the whole tag", () => {
    expect(sectorForTag("data-availability")).toBe("infrastructure");
    expect(sectorForTag("data availability")).toBe("infrastructure");
  });

  it("routes agent and x402 tags to the AI sector", () => {
    expect(sectorForTag("x402")).toBe("ai-agents");
    expect(sectorForTag("agents")).toBe("ai-agents");
  });

  it("falls back to other for unknown and empty tags", () => {
    expect(sectorForTag("zzzquux")).toBe("other");
    expect(sectorForTag("")).toBe("other");
    expect(sectorForTag("   ")).toBe("other");
  });

  it("has a label for every sector it can return", () => {
    for (const tag of ["solana", "lending", "nft", "zzzquux"]) {
      expect(SECTOR_LABELS[sectorForTag(tag)]).toBeTruthy();
    }
  });
});

describe("sectorForPost", () => {
  it("prefers the first meaningful tag over a generic one", () => {
    expect(sectorForPost(["zzzquux", "solana"])).toBe("l1-l2");
  });

  it("returns other when no tag matches", () => {
    expect(sectorForPost(["zzzquux", "whatever"])).toBe("other");
    expect(sectorForPost([])).toBe("other");
  });
});

describe("buildSectorFacets", () => {
  it("counts posts and signals per sector", () => {
    const facets = buildSectorFacets([
      { tags: ["solana"], postKind: "signal" },
      { tags: ["ethereum"], postKind: "research" },
      { tags: ["lending"], postKind: "research" },
    ]);
    const l1 = facets.find((f) => f.sector === "l1-l2");
    expect(l1?.postCount).toBe(2);
    expect(l1?.signalCount).toBe(1);
    expect(facets.find((f) => f.sector === "defi")?.postCount).toBe(1);
  });

  it("omits empty sectors", () => {
    const facets = buildSectorFacets([{ tags: ["solana"] }]);
    expect(facets.map((f) => f.sector)).toEqual(["l1-l2"]);
  });

  it("sorts by post count and pushes other to the end", () => {
    const facets = buildSectorFacets([
      { tags: ["zzzquux"] },
      { tags: ["zzzquux"] },
      { tags: ["zzzquux"] },
      { tags: ["solana"] },
    ]);
    expect(facets[facets.length - 1].sector).toBe("other");
    expect(facets[0].sector).toBe("l1-l2");
  });

  it("only reports tags belonging to their own sector", () => {
    // "research" is a generic tag that maps to other; it must not headline l1-l2.
    const facets = buildSectorFacets([
      { tags: ["solana", "research"] },
      { tags: ["solana", "research"] },
    ]);
    const l1 = facets.find((f) => f.sector === "l1-l2");
    expect(l1?.topTags).toEqual(["solana"]);
  });

  it("ranks top tags by frequency and caps them", () => {
    const facets = buildSectorFacets(
      [
        { tags: ["solana"] },
        { tags: ["solana"] },
        { tags: ["ethereum"] },
        { tags: ["bitcoin"] },
      ],
      { topTagLimit: 2 },
    );
    const l1 = facets.find((f) => f.sector === "l1-l2");
    expect(l1?.topTags[0]).toBe("solana");
    expect(l1?.topTags).toHaveLength(2);
  });

  it("returns an empty list for an empty catalog", () => {
    expect(buildSectorFacets([])).toEqual([]);
  });
});
