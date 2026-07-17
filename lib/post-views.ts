import { createHash } from "node:crypto";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Privacy-light view tracking: one row per (post, viewer, day). The viewer
 * hash is a salted digest of the agent session id — it cannot be reversed to
 * a session and is never joined to identity tables.
 */
export function viewerHash(sessionId: string, day: string): string {
  const salt = process.env.VIEW_HASH_SALT ?? "citation-agent-views";
  return createHash("sha256").update(`${salt}:${sessionId}:${day}`).digest("hex").slice(0, 32);
}

export function referrerHostFrom(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host.slice(0, 100) || null;
  } catch {
    return null;
  }
}

export async function recordPostView(params: {
  postId: string;
  sessionId: string;
  referrer?: string | null;
}): Promise<void> {
  const supabase = getAdminClient();
  if (!supabase) return;

  const day = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("post_views").upsert(
    {
      post_id: params.postId,
      view_day: day,
      viewer_hash: viewerHash(params.sessionId, day),
      referrer_host: referrerHostFrom(params.referrer),
    },
    { onConflict: "post_id,viewer_hash,view_day", ignoreDuplicates: true },
  );

  if (error) {
    console.warn("[post-views] record failed:", error.message);
  }
}

export type PostViewStats = {
  viewsTotal: number;
  views7d: number;
  topReferrers: Array<{ host: string; count: number }>;
};

/** Aggregate view stats for a creator's posts (bounded scan, newest first). */
export async function getViewStatsForPosts(
  postIds: string[],
): Promise<Map<string, PostViewStats>> {
  const out = new Map<string, PostViewStats>();
  if (postIds.length === 0) return out;

  const supabase = getAdminClient();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("post_views")
    .select("post_id, created_at, referrer_host")
    .in("post_id", postIds.slice(0, 100))
    .order("created_at", { ascending: false })
    .limit(20_000);

  if (error) {
    console.warn("[post-views] stats load failed:", error.message);
    return out;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const referrers = new Map<string, Map<string, number>>();

  for (const row of data ?? []) {
    const postId = String(row.post_id);
    const stats = out.get(postId) ?? { viewsTotal: 0, views7d: 0, topReferrers: [] };
    stats.viewsTotal += 1;
    if (new Date(String(row.created_at)).getTime() >= sevenDaysAgo) {
      stats.views7d += 1;
    }
    const host = (row.referrer_host as string | null)?.trim();
    if (host) {
      const perPost = referrers.get(postId) ?? new Map<string, number>();
      perPost.set(host, (perPost.get(host) ?? 0) + 1);
      referrers.set(postId, perPost);
    }
    out.set(postId, stats);
  }

  for (const [postId, hosts] of referrers) {
    const stats = out.get(postId);
    if (!stats) continue;
    stats.topReferrers = [...hosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([host, count]) => ({ host, count }));
  }

  return out;
}
