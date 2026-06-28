import { getAdminClient } from "@/lib/supabase/admin";

export const TRENDING_WINDOW_DAYS = 7;

export type EarningsLedgerRow = {
  citation_id: string;
  creator_wallet: string;
  created_at: string;
  royalty_usdc: string;
};

export type CitationLedgerStats = {
  allTimeReaders: number;
  recentReaders7d: number;
  postEarningsUsdc: number;
};

export type CitationLedgerIndex = {
  byCitation: Map<string, CitationLedgerStats>;
  /** Total creator payout per wallet (all posts). */
  creatorTotalsUsdc: Map<string, number>;
};

const EMPTY_STATS: CitationLedgerStats = {
  allTimeReaders: 0,
  recentReaders7d: 0,
  postEarningsUsdc: 0,
};

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

function parseRoyalty(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Aggregate unlock and earnings stats from creator_earnings rows. */
export function aggregateCitationLedgerStats(
  rows: EarningsLedgerRow[],
  options?: { now?: Date; trendingDays?: number },
): CitationLedgerIndex {
  const now = options?.now ?? new Date();
  const trendingDays = options?.trendingDays ?? TRENDING_WINDOW_DAYS;
  const windowStartMs = now.getTime() - trendingDays * 24 * 60 * 60 * 1000;

  const byCitation = new Map<string, CitationLedgerStats>();
  const creatorTotalsUsdc = new Map<string, number>();

  for (const row of rows) {
    const citationId = row.citation_id;
    const wallet = normalizeWallet(row.creator_wallet);
    const royalty = parseRoyalty(row.royalty_usdc);
    const createdMs = new Date(row.created_at).getTime();
    const inTrendingWindow = Number.isFinite(createdMs) && createdMs >= windowStartMs;

    const prior = byCitation.get(citationId) ?? { ...EMPTY_STATS };
    byCitation.set(citationId, {
      allTimeReaders: prior.allTimeReaders + 1,
      recentReaders7d: prior.recentReaders7d + (inTrendingWindow ? 1 : 0),
      postEarningsUsdc: prior.postEarningsUsdc + royalty,
    });

    if (wallet) {
      creatorTotalsUsdc.set(wallet, (creatorTotalsUsdc.get(wallet) ?? 0) + royalty);
    }
  }

  return { byCitation, creatorTotalsUsdc };
}

export function getCitationLedgerStats(
  index: CitationLedgerIndex,
  citationId: string,
): CitationLedgerStats {
  return index.byCitation.get(citationId) ?? { ...EMPTY_STATS };
}

export function getCreatorEarningsUsdc(
  index: CitationLedgerIndex,
  creatorWallet: string,
): number {
  return index.creatorTotalsUsdc.get(normalizeWallet(creatorWallet)) ?? 0;
}

export function aggregateCreatorTotals(
  rows: { creator_wallet: string; royalty_usdc: string }[],
): Map<string, number> {
  const creatorTotalsUsdc = new Map<string, number>();
  for (const row of rows) {
    const wallet = normalizeWallet(row.creator_wallet);
    if (!wallet) continue;
    creatorTotalsUsdc.set(
      wallet,
      (creatorTotalsUsdc.get(wallet) ?? 0) + parseRoyalty(row.royalty_usdc),
    );
  }
  return creatorTotalsUsdc;
}

/** Load per-post and per-creator earnings stats for catalog listings. */
export async function fetchCitationLedgerStats(
  citationIds: string[],
  creatorWallets: string[] = [],
): Promise<CitationLedgerIndex> {
  if (citationIds.length === 0 && creatorWallets.length === 0) {
    return { byCitation: new Map(), creatorTotalsUsdc: new Map() };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { byCitation: new Map(), creatorTotalsUsdc: new Map() };
  }

  const uniqueWallets = [...new Set(creatorWallets.map((w) => w.trim()).filter(Boolean))];

  const [citationResult, creatorResult] = await Promise.all([
    citationIds.length > 0
      ? supabase
          .from("creator_earnings")
          .select("citation_id, creator_wallet, created_at, royalty_usdc")
          .in("citation_id", citationIds)
      : Promise.resolve({ data: [], error: null }),
    uniqueWallets.length > 0
      ? supabase
          .from("creator_earnings")
          .select("creator_wallet, royalty_usdc")
          .in("creator_wallet", uniqueWallets)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (citationResult.error) {
    console.error(
      "[catalog-earnings-stats] citation earnings query failed:",
      citationResult.error.message,
    );
  }
  if (creatorResult.error) {
    console.error(
      "[catalog-earnings-stats] creator earnings query failed:",
      creatorResult.error.message,
    );
  }

  const postIndex = aggregateCitationLedgerStats(
    (citationResult.data ?? []) as EarningsLedgerRow[],
  );

  return {
    byCitation: postIndex.byCitation,
    creatorTotalsUsdc: aggregateCreatorTotals(
      (creatorResult.data ?? []) as { creator_wallet: string; royalty_usdc: string }[],
    ),
  };
}