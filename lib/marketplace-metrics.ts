import { getAdminClient } from "@/lib/supabase/admin";
import { loadAllCreatorContent } from "@/lib/citations";
import { filterPublicResearchCatalog } from "@/lib/catalog-filter";
import { getCampaignStartIso } from "@/lib/campaign";
import type { CreatorContent } from "@/lib/citations";

/**
 * In-house seed identity that must not be counted as an external creator.
 * Citation Team is the renamed seed research; these wallets are test/seed payers.
 */
const CITATION_TEAM_NAME = "citation team";
const SEED_WALLETS = new Set<string>([
  "0x60c05e2d820ce989e944ed4e7bb33baeb8705c62",
  "0x0f293d22dee9fccfc13ce095a2c1d4293a670449",
  "0x33e27d6dc287b1ea58865ddd9cf9460a53224134",
  "0x0965ee2065884321b8b12d269925785a56b98804",
]);

export type MarketplaceMetrics = {
  /** Distinct real external creators with published public listings (excludes Citation Team seeds). */
  creatorsPublishing: number;
  /** Published reports visible in the public catalog. */
  reportsAvailable: number;
  /** Unlocks (creator_earnings rows) at/after the campaign start. */
  unlocksSinceLaunch: number;
  /** Sum of royalty_usdc paid to creators at/after the campaign start, trimmed string. */
  paidToCreatorsUsdc: string;
  /** Campaign start the "since launch" figures count from (ISO 8601). */
  campaignStart: string;
};

type EarningRow = { created_at: string; royalty_usdc: string };
type CreatorLike = Pick<CreatorContent, "author" | "connectedWallet">;

/** A published listing counts as a real external creator unless it is in-house seed. */
export function isRealExternalCreator(post: CreatorLike): boolean {
  if ((post.author ?? "").trim().toLowerCase() === CITATION_TEAM_NAME) return false;
  if (SEED_WALLETS.has((post.connectedWallet ?? "").toLowerCase())) return false;
  return true;
}

/** Distinct real external creators, keyed by author name (case-insensitive). */
export function countRealCreators(posts: CreatorLike[]): number {
  const names = new Set<string>();
  for (const post of posts) {
    if (!isRealExternalCreator(post)) continue;
    const name = (post.author ?? "").trim().toLowerCase();
    if (name) names.add(name);
  }
  return names.size;
}

/** Trim trailing zeros from a fixed-decimal USDC amount for display. */
export function formatUsdc(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return amount.toFixed(6).replace(/\.?0+$/, "") || "0";
}

/**
 * Count unlocks and sum creator royalties for rows at/after the campaign start.
 * Pure: rows before `start` are excluded, rows at or after `start` are included.
 */
export function summarizeSinceLaunch(
  rows: EarningRow[],
  start: Date,
): { unlocksSinceLaunch: number; paidToCreators: number } {
  const startMs = start.getTime();
  let unlocks = 0;
  let paid = 0;
  for (const row of rows) {
    const t = new Date(row.created_at).getTime();
    if (!Number.isFinite(t) || t < startMs) continue;
    unlocks += 1;
    const royalty = parseFloat(row.royalty_usdc);
    if (Number.isFinite(royalty)) paid += royalty;
  }
  return { unlocksSinceLaunch: unlocks, paidToCreators: paid };
}

/**
 * Aggregate the public marketplace metrics. Runs server-side via the service-role
 * admin client; only rolled-up totals are returned, never raw ledger rows. The
 * anon key never touches the financial tables (RLS lock stays intact).
 */
export async function computeMarketplaceMetrics(): Promise<MarketplaceMetrics> {
  const campaignStart = getCampaignStartIso();

  // Current-state catalog counts (what the public catalog actually shows).
  const catalog = filterPublicResearchCatalog(await loadAllCreatorContent());
  const reportsAvailable = catalog.length;
  const creatorsPublishing = countRealCreators(catalog);

  // Since-launch money/unlock counts from the locked ledger via admin client.
  let unlocksSinceLaunch = 0;
  let paidToCreators = 0;

  const supabase = getAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("creator_earnings")
      .select("created_at, royalty_usdc")
      .gte("created_at", campaignStart);

    if (error) {
      console.error("[marketplace-metrics] earnings query failed:", error.message);
    } else {
      const summary = summarizeSinceLaunch((data ?? []) as EarningRow[], new Date(campaignStart));
      unlocksSinceLaunch = summary.unlocksSinceLaunch;
      paidToCreators = summary.paidToCreators;
    }
  }

  return {
    creatorsPublishing,
    reportsAvailable,
    unlocksSinceLaunch,
    paidToCreatorsUsdc: formatUsdc(paidToCreators),
    campaignStart,
  };
}
