/**
 * Demand board composition (Phase 2) — loads the ledger and catalog, then hands
 * them to the pure summarizers in demand-surfaces / conviction-changes / sectors.
 *
 * Reads only. Every query is bounded and soft-fails: a demand surface must never
 * be able to take down the marketplace page it sits on.
 */

import { getAdminClient } from "@/lib/supabase/admin";
import { loadAllCreatorContent } from "@/lib/citations";
import { filterPublicResearchCatalog } from "@/lib/catalog-filter";
import { isRealCreatorIdentity } from "@/lib/marketplace-metrics";
import {
  detectConvictionChanges,
  type ConvictionChange,
} from "@/lib/conviction-changes";
import {
  buildSectorFacets,
  type SectorFacet,
} from "@/lib/sectors";
import {
  countAllTimeUnlocksByDesk,
  demandWindowStart,
  summarizeDemand,
  type DemandPostMeta,
  type DemandSnapshot,
  type DemandUnlockRow,
  type DemandWindow,
} from "@/lib/demand-surfaces";

/** Ledger scan ceiling. Well above testnet volume; keeps the query bounded. */
const LEDGER_SCAN_LIMIT = 20_000;
const AGENT_WALLET_SCAN_LIMIT = 10_000;

export type DemandBoard = {
  demand: DemandSnapshot;
  convictionChanges: ConvictionChange[];
  sectors: SectorFacet[];
  /** True when signal resolution data would be needed but does not exist yet. */
  resolutionsAvailable: false;
};

/**
 * Session-agent wallet addresses, lowercased.
 *
 * viem checksums addresses on write while x402 payer strings are not guaranteed
 * to be checksummed, so classification must compare case-insensitively.
 */
async function loadAgentAddresses(): Promise<Set<string>> {
  const out = new Set<string>();
  const supabase = getAdminClient();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("user_agent_wallets")
    .select("address")
    .limit(AGENT_WALLET_SCAN_LIMIT);

  if (error) {
    console.warn("[demand-board] agent wallet load failed:", error.message);
    return out;
  }
  for (const row of data ?? []) {
    const address = String(row.address ?? "").trim().toLowerCase();
    if (address) out.add(address);
  }
  return out;
}

async function loadUnlockRows(
  since: Date,
  priorSince: Date,
): Promise<{
  windowRows: DemandUnlockRow[];
  priorByDesk: Map<string, number>;
  allTimeByDesk: Map<string, number>;
}> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { windowRows: [], priorByDesk: new Map(), allTimeByDesk: new Map() };
  }

  const [spanResult, allTimeResult] = await Promise.all([
    // One query covering the window plus the equal-length period before it;
    // split below so the rising lane can compare period over period.
    supabase
      .from("creator_earnings")
      .select(
        "citation_id, creator_name, creator_wallet, payer, gross_usdc, royalty_usdc, created_at",
      )
      .gte("created_at", priorSince.toISOString())
      .order("created_at", { ascending: false })
      .limit(LEDGER_SCAN_LIMIT),
    supabase
      .from("creator_earnings")
      .select("creator_name")
      .limit(LEDGER_SCAN_LIMIT),
  ]);

  if (spanResult.error) {
    console.warn(
      "[demand-board] window ledger load failed:",
      spanResult.error.message,
    );
  }
  if (allTimeResult.error) {
    console.warn(
      "[demand-board] lifetime ledger load failed:",
      allTimeResult.error.message,
    );
  }

  const sinceMs = since.getTime();
  const windowRows: DemandUnlockRow[] = [];
  const priorRows: Array<{ creator_name: string }> = [];

  for (const row of (spanResult.data ?? []) as DemandUnlockRow[]) {
    const at = new Date(row.created_at).getTime();
    if (!Number.isFinite(at)) continue;
    if (at >= sinceMs) windowRows.push(row);
    else priorRows.push({ creator_name: row.creator_name });
  }

  return {
    windowRows,
    priorByDesk: countAllTimeUnlocksByDesk(priorRows),
    allTimeByDesk: countAllTimeUnlocksByDesk(
      (allTimeResult.data ?? []) as Array<{ creator_name: string }>,
    ),
  };
}

export async function loadDemandBoard(
  window: DemandWindow,
  options?: { now?: Date },
): Promise<DemandBoard> {
  const now = options?.now ?? new Date();
  const since = demandWindowStart(window, now);
  // Equal-length period immediately before the window, for growth comparison.
  const priorSince = new Date(since.getTime() - (now.getTime() - since.getTime()));

  const [catalog, agentAddresses, ledger] = await Promise.all([
    loadAllCreatorContent().then(filterPublicResearchCatalog).catch((err) => {
      console.warn("[demand-board] catalog load failed:", err);
      return [];
    }),
    loadAgentAddresses(),
    loadUnlockRows(since, priorSince),
  ]);

  const postMeta = new Map<string, DemandPostMeta>();
  const titles = new Map<string, string>();
  for (const post of catalog) {
    postMeta.set(post.id, {
      id: post.id,
      title: post.title,
      author: post.author,
      postKind: post.postKind === "signal" ? "signal" : "research",
      tags: post.tags ?? [],
    });
    titles.set(post.id, post.title);
  }

  const demand = summarizeDemand(ledger.windowRows, {
    window,
    now,
    agentAddresses,
    postMeta,
    allTimeUnlocksByDesk: ledger.allTimeByDesk,
    priorUnlocksByDesk: ledger.priorByDesk,
    isRealDesk: isRealCreatorIdentity,
  });

  const convictionChanges = detectConvictionChanges(
    catalog.map((post) => ({
      id: post.id,
      author: post.author,
      tags: post.tags ?? [],
      postKind: post.postKind === "signal" ? "signal" : "research",
      signalDirection: post.signalDirection ?? null,
      signalConfidence: post.signalConfidence ?? null,
      publishedAt: post.publishedAt,
    })),
    { now, windowDays: 30, titles },
  );

  const sectors = buildSectorFacets(
    catalog.map((post) => ({
      tags: post.tags ?? [],
      postKind: post.postKind === "signal" ? "signal" : "research",
    })),
  );

  return {
    demand,
    convictionChanges,
    sectors,
    // Signal outcome logging (right / wrong / void) is Phase 3. Until that
    // store exists there is nothing truthful to show for "just resolved".
    resolutionsAvailable: false,
  };
}
