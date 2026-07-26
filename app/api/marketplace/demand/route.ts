import { NextResponse, type NextRequest } from "next/server";
import { loadDemandBoard } from "@/lib/demand-board";
import { isDemandWindow, type DemandWindow } from "@/lib/demand-surfaces";
import { buildProfilePath, buildReportPath } from "@/lib/profile-url";

/** Demand aggregation touches the ledger and catalog; allow a slower budget. */
export const maxDuration = 30;

const DEFAULT_WINDOW: DemandWindow = "7d";

/**
 * Public demand board: what agents and humans bought, which desks are winning,
 * which are rising, and which desks changed their mind.
 *
 * Read-only and aggregate-only — no ledger rows, payers, or wallets are ever
 * returned, so the anon-facing surface cannot leak buyer identity.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("window");
  const window: DemandWindow = isDemandWindow(raw) ? raw : DEFAULT_WINDOW;

  try {
    const board = await loadDemandBoard(window);
    const { demand } = board;

    return NextResponse.json({
      window: demand.window,
      since: demand.since,
      totals: {
        unlocks: demand.totalUnlocks,
        agent_unlocks: demand.agentUnlocks,
        human_unlocks: demand.humanUnlocks,
        agent_share_pct: demand.agentSharePct,
        earned_usdc: demand.earnedUsdc,
      },
      top_desks: demand.topDesks.map((desk) => ({
        username: desk.username,
        unlocks: desk.unlocks,
        agent_unlocks: desk.agentUnlocks,
        human_unlocks: desk.humanUnlocks,
        earned_usdc: desk.earnedUsdc,
        profile_path: buildProfilePath(desk.username),
      })),
      rising_desks: demand.risingDesks.map((desk) => ({
        username: desk.username,
        window_unlocks: desk.windowUnlocks,
        prior_unlocks: desk.priorUnlocks,
        all_time_unlocks: desk.allTimeUnlocks,
        growth: Math.round(desk.growth * 1000) / 1000,
        profile_path: buildProfilePath(desk.username),
      })),
      top_signals: demand.topSignals.map((post) => ({
        post_id: post.postId,
        title: post.title,
        author: post.author,
        unlocks: post.unlocks,
        agent_unlocks: post.agentUnlocks,
        path: buildReportPath(post.postId),
      })),
      top_research: demand.topResearch.map((post) => ({
        post_id: post.postId,
        title: post.title,
        author: post.author,
        unlocks: post.unlocks,
        agent_unlocks: post.agentUnlocks,
        path: buildReportPath(post.postId),
      })),
      recent_unlocks: demand.recentUnlocks.map((row) => ({
        post_id: row.postId,
        title: row.title,
        author: row.author,
        post_kind: row.postKind,
        payer_kind: row.payerKind,
        at: row.at,
        path: buildReportPath(row.postId),
      })),
      conviction_changes: board.convictionChanges.map((change) => ({
        username: change.username,
        theme: change.theme,
        from_direction: change.fromDirection,
        to_direction: change.toDirection,
        to_post_id: change.toPostId,
        to_title: change.toTitle ?? null,
        to_confidence: change.toConfidence,
        changed_at: change.changedAt,
        path: buildReportPath(change.toPostId),
        profile_path: buildProfilePath(change.username),
      })),
      sectors: board.sectors.map((facet) => ({
        sector: facet.sector,
        label: facet.label,
        post_count: facet.postCount,
        signal_count: facet.signalCount,
        top_tags: facet.topTags,
      })),
      // Signal outcome logging is Phase 3; surfaced explicitly so clients do not
      // have to guess why a "just resolved" lane is absent.
      resolutions_available: board.resolutionsAvailable,
    });
  } catch (err) {
    console.error(
      "[demand] board load failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Failed to load demand board" },
      { status: 500 },
    );
  }
}
