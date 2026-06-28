export type CatalogSortMode = "latest" | "readers" | "trending" | "earning";

export type CatalogSortableListing = {
  id: string;
  paid_count: number;
  recent_readers_7d?: number;
  creator_earnings_usdc?: number;
  post_earnings_usdc?: number;
  published_at?: string;
};

function publishedAtMs(value: string | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function compareId(a: CatalogSortableListing, b: CatalogSortableListing): number {
  return a.id.localeCompare(b.id);
}

/** Stable catalog sort — latest is the default browse order. */
export function sortCatalogListings<T extends CatalogSortableListing>(
  items: T[],
  mode: CatalogSortMode,
): T[] {
  if (mode === "latest") {
    return [...items].sort((a, b) => {
      const aMs = publishedAtMs(a.published_at);
      const bMs = publishedAtMs(b.published_at);
      if (bMs !== aMs) return bMs - aMs;
      return compareId(a, b);
    });
  }

  if (mode === "readers") {
    return [...items].sort((a, b) => {
      if (b.paid_count !== a.paid_count) return b.paid_count - a.paid_count;
      return compareId(a, b);
    });
  }

  if (mode === "trending") {
    return [...items].sort((a, b) => {
      const aTrend = a.recent_readers_7d ?? 0;
      const bTrend = b.recent_readers_7d ?? 0;
      if (bTrend !== aTrend) return bTrend - aTrend;
      if (b.paid_count !== a.paid_count) return b.paid_count - a.paid_count;
      return compareId(a, b);
    });
  }

  return [...items].sort((a, b) => {
    const aCreator = a.creator_earnings_usdc ?? 0;
    const bCreator = b.creator_earnings_usdc ?? 0;
    if (bCreator !== aCreator) return bCreator - aCreator;
    const aPost = a.post_earnings_usdc ?? 0;
    const bPost = b.post_earnings_usdc ?? 0;
    if (bPost !== aPost) return bPost - aPost;
    return compareId(a, b);
  });
}