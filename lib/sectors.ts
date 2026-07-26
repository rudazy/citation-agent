/**
 * Sector / theme discovery (Phase 2).
 *
 * Creators tag freely, which is good for authorship and bad for browsing: a
 * catalog with forty one-off tags has no navigable shape. Sectors fold those
 * tags into a small, stable set of crypto research niches.
 *
 * Deliberately a static mapping, not inferred: a sector list that shifts with
 * the catalog would reorder the UI under buyers and cannot be reasoned about.
 * Unmatched tags fall through to "Other" rather than minting a new sector.
 */

export const SECTORS = [
  "l1-l2",
  "defi",
  "stablecoins",
  "infrastructure",
  "ai-agents",
  "nft-gaming",
  "macro",
  "governance",
  "other",
] as const;

export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  "l1-l2": "L1 / L2",
  defi: "DeFi",
  stablecoins: "Stablecoins & payments",
  infrastructure: "Infrastructure",
  "ai-agents": "AI & agents",
  "nft-gaming": "NFT & gaming",
  macro: "Macro & markets",
  governance: "Governance",
  other: "Other",
};

/**
 * Tag keywords per sector. Order matters: the first sector with a hit wins, so
 * narrower sectors come before broader ones.
 *
 * Matching is token-based, never substring — short keywords collide badly
 * otherwise ("dao" contains "da", "blockchain" contains "ai", "indexer"
 * contains "dex"). See matchesKeyword.
 */
const SECTOR_KEYWORDS: Array<[Sector, string[]]> = [
  [
    "stablecoins",
    ["stablecoin", "usdc", "usdt", "payment", "rwa", "tokenized", "circle", "arc"],
  ],
  [
    "ai-agents",
    ["ai", "agent", "x402", "mcp", "llm", "inference", "machine"],
  ],
  [
    "defi",
    [
      "defi",
      "dex",
      "amm",
      "lending",
      "perp",
      "yield",
      "vault",
      "liquid",
      "staking",
      "restaking",
    ],
  ],
  [
    "l1-l2",
    [
      "l1",
      "l2",
      "layer",
      "rollup",
      "ethereum",
      "eth",
      "solana",
      "sol",
      "bitcoin",
      "btc",
      "arbitrum",
      "optimism",
      "base",
      "sui",
      "avalanche",
      "cosmos",
      "polygon",
    ],
  ],
  [
    "infrastructure",
    [
      "infra",
      "oracle",
      "bridge",
      "rpc",
      "data-availability",
      "availability",
      "indexer",
      "node",
      "zk",
      "prover",
      "trust",
      "identity",
    ],
  ],
  ["nft-gaming", ["nft", "gaming", "game", "metaverse", "collectible"]],
  ["governance", ["governance", "dao", "voting", "treasury", "regulation", "policy"]],
  ["macro", ["macro", "market", "trading", "cycle", "etf", "liquidity", "rates"]],
];

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Split a tag into comparable words: "ethereum-l2" -> ["ethereum", "l2"]. */
function tagTokens(tag: string): string[] {
  return normalizeTag(tag)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Token match with simple plural tolerance, so "perps" hits "perp" and
 * "stablecoins" hits "stablecoin" without letting "dao" hit "da".
 * Multi-word keywords are compared against the whole hyphenated tag.
 */
function matchesKeyword(tag: string, keyword: string): boolean {
  const normalized = normalizeTag(tag);
  if (normalized === keyword) return true;

  if (keyword.includes("-") || keyword.includes(" ")) {
    return normalized.replace(/[^a-z0-9]+/g, "-") === keyword;
  }

  for (const token of tagTokens(tag)) {
    if (token === keyword) return true;
    if (token === `${keyword}s`) return true;
    if (`${token}s` === keyword) return true;
  }
  return false;
}

/** Sector for a single tag; "other" when nothing matches. */
export function sectorForTag(tag: string): Sector {
  if (!normalizeTag(tag)) return "other";

  for (const [sector, keywords] of SECTOR_KEYWORDS) {
    for (const keyword of keywords) {
      if (matchesKeyword(tag, keyword)) return sector;
    }
  }
  return "other";
}

/**
 * Sector for a post: the first non-"other" sector across its tags, so a post
 * tagged ["research", "solana"] classifies as l1-l2 rather than Other.
 */
export function sectorForPost(tags: string[]): Sector {
  for (const tag of tags ?? []) {
    const sector = sectorForTag(tag);
    if (sector !== "other") return sector;
  }
  return "other";
}

export type SectorFacet = {
  sector: Sector;
  label: string;
  postCount: number;
  signalCount: number;
  /** Representative tags in this sector, most common first. */
  topTags: string[];
};

export type SectorFacetPost = {
  tags: string[];
  postKind?: "research" | "signal";
};

/**
 * Sector facets for a catalog, most populated first. Empty sectors are omitted
 * so the discovery lane never shows a dead end.
 */
export function buildSectorFacets(
  posts: SectorFacetPost[],
  options?: { topTagLimit?: number },
): SectorFacet[] {
  const topTagLimit = options?.topTagLimit ?? 3;

  const counts = new Map<
    Sector,
    { postCount: number; signalCount: number; tags: Map<string, number> }
  >();

  for (const post of posts) {
    const sector = sectorForPost(post.tags ?? []);
    const entry =
      counts.get(sector) ?? { postCount: 0, signalCount: 0, tags: new Map() };

    entry.postCount += 1;
    if (post.postKind === "signal") entry.signalCount += 1;

    for (const rawTag of post.tags ?? []) {
      const tag = normalizeTag(rawTag);
      if (!tag) continue;
      // Only count tags that belong to this sector, so "research" does not
      // become the headline tag of every lane.
      if (sectorForTag(tag) !== sector) continue;
      entry.tags.set(tag, (entry.tags.get(tag) ?? 0) + 1);
    }

    counts.set(sector, entry);
  }

  return [...counts.entries()]
    .map(([sector, entry]) => ({
      sector,
      label: SECTOR_LABELS[sector],
      postCount: entry.postCount,
      signalCount: entry.signalCount,
      topTags: [...entry.tags.entries()]
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        })
        .slice(0, topTagLimit)
        .map(([tag]) => tag),
    }))
    .filter((facet) => facet.postCount > 0)
    .sort((a, b) => {
      // "Other" is a fallback bucket, never a headline lane.
      if (a.sector === "other" && b.sector !== "other") return 1;
      if (b.sector === "other" && a.sector !== "other") return -1;
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      return a.label.localeCompare(b.label);
    });
}
