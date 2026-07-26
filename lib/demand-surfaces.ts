/**
 * Demand surfaces (Phase 2) — why a buyer or creator opens the product daily.
 *
 * Everything here is derived from the existing unlock ledger (`creator_earnings`)
 * plus the published catalog. No new writes, no new payment rails.
 *
 * Agent vs human is decided by whether the payer wallet belongs to a session
 * agent (`user_agent_wallets`). Addresses from viem are checksummed while x402
 * payer strings are not guaranteed to be, so every comparison is lowercased.
 */

export type PayerKind = "agent" | "human";

export const DEMAND_WINDOWS = ["1d", "7d", "30d"] as const;
export type DemandWindow = (typeof DEMAND_WINDOWS)[number];

export const DEMAND_WINDOW_DAYS: Record<DemandWindow, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
};

export const DEMAND_WINDOW_LABELS: Record<DemandWindow, string> = {
  "1d": "Today",
  "7d": "This week",
  "30d": "This month",
};

export function isDemandWindow(value: unknown): value is DemandWindow {
  return (
    typeof value === "string" && (DEMAND_WINDOWS as readonly string[]).includes(value)
  );
}

export function demandWindowStart(window: DemandWindow, now = new Date()): Date {
  return new Date(now.getTime() - DEMAND_WINDOW_DAYS[window] * 24 * 60 * 60 * 1000);
}

export type DemandUnlockRow = {
  citation_id: string;
  creator_name: string;
  creator_wallet: string;
  payer: string;
  gross_usdc: string;
  royalty_usdc: string;
  created_at: string;
};

/** Catalog facts the ledger alone cannot supply. */
export type DemandPostMeta = {
  id: string;
  title: string;
  author: string;
  postKind: "research" | "signal";
  tags: string[];
};

export type DeskDemand = {
  username: string;
  unlocks: number;
  agentUnlocks: number;
  humanUnlocks: number;
  earnedUsdc: string;
};

export type RisingDesk = {
  username: string;
  windowUnlocks: number;
  /** Unlocks in the equal-length period immediately before the window. */
  priorUnlocks: number;
  allTimeUnlocks: number;
  /**
   * Period-over-period growth: (window - prior) / max(prior, 1).
   * A desk going 0 -> 5 scores 5; a desk flat at 100 scores 0.
   */
  growth: number;
};

export type RecentUnlock = {
  postId: string;
  title: string;
  author: string;
  postKind: "research" | "signal";
  payerKind: PayerKind;
  at: string;
};

export type TopPost = {
  postId: string;
  title: string;
  author: string;
  postKind: "research" | "signal";
  unlocks: number;
  agentUnlocks: number;
};

export type DemandSnapshot = {
  window: DemandWindow;
  since: string;
  totalUnlocks: number;
  agentUnlocks: number;
  humanUnlocks: number;
  /** Agent share of unlocks, 0-100, rounded to one decimal. */
  agentSharePct: number;
  earnedUsdc: string;
  topDesks: DeskDemand[];
  risingDesks: RisingDesk[];
  topSignals: TopPost[];
  topResearch: TopPost[];
  recentUnlocks: RecentUnlock[];
};

const USDC_DECIMALS = 6;

function normalizeWallet(value: string): string {
  return value.trim().toLowerCase();
}

function parseAmount(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function classifyPayer(
  payer: string,
  agentAddresses: Set<string>,
): PayerKind {
  return agentAddresses.has(normalizeWallet(payer)) ? "agent" : "human";
}

/** Keep in-house seed identities out of public demand surfaces. */
function deskKey(name: string): string {
  return name.trim().toLowerCase();
}

export type SummarizeDemandOptions = {
  window: DemandWindow;
  now?: Date;
  /** Lowercased session-agent wallet addresses. */
  agentAddresses?: Set<string>;
  postMeta?: Map<string, DemandPostMeta>;
  /** All-time unlock count per desk, shown as context on the rising lane. */
  allTimeUnlocksByDesk?: Map<string, number>;
  /**
   * Unlocks per desk in the equal-length period before the window. Without it
   * every desk looks equally "rising" and the lane just mirrors top desks.
   */
  priorUnlocksByDesk?: Map<string, number>;
  /** Returns false for seed/in-house identities that must not be surfaced. */
  isRealDesk?: (name: string, wallet: string) => boolean;
  topDeskLimit?: number;
  risingLimit?: number;
  recentLimit?: number;
  topPostLimit?: number;
};

/**
 * Roll unlock ledger rows into the public demand board.
 *
 * Pure: callers supply the window, clock, agent wallet set, and catalog meta, so
 * every surface below is reproducible in tests without a database.
 */
export function summarizeDemand(
  rows: DemandUnlockRow[],
  options: SummarizeDemandOptions,
): DemandSnapshot {
  const now = options.now ?? new Date();
  const since = demandWindowStart(options.window, now);
  const sinceMs = since.getTime();
  const agentAddresses = options.agentAddresses ?? new Set<string>();
  const postMeta = options.postMeta ?? new Map<string, DemandPostMeta>();
  const isRealDesk = options.isRealDesk ?? (() => true);

  let totalUnlocks = 0;
  let agentUnlocks = 0;
  let earned = 0;

  const desks = new Map<string, DeskDemand>();
  const posts = new Map<string, TopPost>();
  const recent: RecentUnlock[] = [];

  for (const row of rows) {
    const at = new Date(row.created_at).getTime();
    if (!Number.isFinite(at) || at < sinceMs) continue;
    if (!isRealDesk(row.creator_name, row.creator_wallet)) continue;

    const kind = classifyPayer(row.payer, agentAddresses);
    totalUnlocks += 1;
    if (kind === "agent") agentUnlocks += 1;
    earned += parseAmount(row.royalty_usdc);

    const username = deskKey(row.creator_name);
    const desk = desks.get(username) ?? {
      username,
      unlocks: 0,
      agentUnlocks: 0,
      humanUnlocks: 0,
      earnedUsdc: "0",
    };
    desk.unlocks += 1;
    if (kind === "agent") desk.agentUnlocks += 1;
    else desk.humanUnlocks += 1;
    desk.earnedUsdc = (
      parseAmount(desk.earnedUsdc) + parseAmount(row.royalty_usdc)
    ).toFixed(USDC_DECIMALS);
    desks.set(username, desk);

    const meta = postMeta.get(row.citation_id);
    const post = posts.get(row.citation_id) ?? {
      postId: row.citation_id,
      title: meta?.title ?? row.citation_id,
      author: meta?.author ?? username,
      postKind: meta?.postKind ?? "research",
      unlocks: 0,
      agentUnlocks: 0,
    };
    post.unlocks += 1;
    if (kind === "agent") post.agentUnlocks += 1;
    posts.set(row.citation_id, post);

    recent.push({
      postId: row.citation_id,
      title: meta?.title ?? row.citation_id,
      author: meta?.author ?? username,
      postKind: meta?.postKind ?? "research",
      payerKind: kind,
      at: row.created_at,
    });
  }

  const topDesks = [...desks.values()]
    .sort((a, b) => {
      if (b.unlocks !== a.unlocks) return b.unlocks - a.unlocks;
      const earnDiff = parseAmount(b.earnedUsdc) - parseAmount(a.earnedUsdc);
      if (earnDiff !== 0) return earnDiff;
      return a.username.localeCompare(b.username);
    })
    .slice(0, options.topDeskLimit ?? 5);

  const allTime = options.allTimeUnlocksByDesk ?? new Map<string, number>();
  const prior = options.priorUnlocksByDesk ?? new Map<string, number>();
  const risingDesks = [...desks.values()]
    .map((desk) => {
      const priorUnlocks = prior.get(desk.username) ?? 0;
      const lifetime = Math.max(
        allTime.get(desk.username) ?? desk.unlocks,
        desk.unlocks,
      );
      return {
        username: desk.username,
        windowUnlocks: desk.unlocks,
        priorUnlocks,
        allTimeUnlocks: lifetime,
        growth: (desk.unlocks - priorUnlocks) / Math.max(priorUnlocks, 1),
      } satisfies RisingDesk;
    })
    // Only genuinely accelerating desks; a flat or declining desk is not rising.
    .filter((desk) => desk.growth > 0)
    // Growth alone would crown any desk with a single new unlock, so weight it
    // by volume: rising fast AND selling more ranks higher.
    .sort((a, b) => {
      const aScore = a.growth * a.windowUnlocks;
      const bScore = b.growth * b.windowUnlocks;
      if (bScore !== aScore) return bScore - aScore;
      return a.username.localeCompare(b.username);
    })
    .slice(0, options.risingLimit ?? 5);

  const rankPosts = (kind: "research" | "signal"): TopPost[] =>
    [...posts.values()]
      .filter((p) => p.postKind === kind)
      .sort((a, b) => {
        if (b.unlocks !== a.unlocks) return b.unlocks - a.unlocks;
        return a.postId.localeCompare(b.postId);
      })
      .slice(0, options.topPostLimit ?? 5);

  recent.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    window: options.window,
    since: since.toISOString(),
    totalUnlocks,
    agentUnlocks,
    humanUnlocks: totalUnlocks - agentUnlocks,
    agentSharePct:
      totalUnlocks > 0
        ? Math.round((agentUnlocks / totalUnlocks) * 1000) / 10
        : 0,
    earnedUsdc: earned.toFixed(USDC_DECIMALS),
    topDesks,
    risingDesks,
    topSignals: rankPosts("signal"),
    topResearch: rankPosts("research"),
    recentUnlocks: recent.slice(0, options.recentLimit ?? 12),
  };
}

/** All-time unlocks per desk, for momentum comparisons. */
export function countAllTimeUnlocksByDesk(
  rows: Array<{ creator_name: string }>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const key = deskKey(row.creator_name);
    if (!key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}
