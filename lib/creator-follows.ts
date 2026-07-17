import { getAdminClient } from "@/lib/supabase/admin";
import {
  getProfileById,
  getProfileByUsername,
  type PlatformProfile,
} from "@/lib/platform-profile";
import {
  loadPublishedPostsFromDb,
  rowToCreatorContent,
  type CreatorPostRow,
} from "@/lib/creator-posts";
import type { CreatorContent } from "@/lib/citations";

export type FollowResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function isFollowing(
  followerProfileId: string,
  creatorProfileId: string,
): Promise<boolean> {
  const supabase = getAdminClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("creator_follows")
    .select("id")
    .eq("follower_profile_id", followerProfileId)
    .eq("creator_profile_id", creatorProfileId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function followCreator(
  followerProfileId: string,
  creatorUsername: string,
): Promise<FollowResult> {
  const creator = await getProfileByUsername(creatorUsername);
  if (!creator) {
    return { ok: false, error: "Creator not found", status: 404 };
  }
  if (creator.id === followerProfileId) {
    return { ok: false, error: "You cannot follow yourself", status: 400 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Follow is not configured", status: 503 };
  }

  const { error } = await supabase.from("creator_follows").upsert(
    {
      follower_profile_id: followerProfileId,
      creator_profile_id: creator.id,
    },
    { onConflict: "follower_profile_id,creator_profile_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[creator-follows] follow failed:", error.message);
    return { ok: false, error: "Failed to follow creator", status: 500 };
  }

  // Best-effort in-app notification; never fails the follow itself.
  const { createNotification } = await import("@/lib/notifications");
  const follower = await getProfileById(followerProfileId);
  await createNotification({
    profileId: creator.id,
    type: "follow",
    actorUsername: follower?.username ?? null,
  });

  return { ok: true };
}

export async function unfollowCreator(
  followerProfileId: string,
  creatorUsername: string,
): Promise<FollowResult> {
  const creator = await getProfileByUsername(creatorUsername);
  if (!creator) {
    return { ok: false, error: "Creator not found", status: 404 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Follow is not configured", status: 503 };
  }

  const { error } = await supabase
    .from("creator_follows")
    .delete()
    .eq("follower_profile_id", followerProfileId)
    .eq("creator_profile_id", creator.id);

  if (error) {
    console.error("[creator-follows] unfollow failed:", error.message);
    return { ok: false, error: "Failed to unfollow", status: 500 };
  }
  return { ok: true };
}

export async function listFollowedCreators(
  followerProfileId: string,
): Promise<PlatformProfile[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("creator_follows")
    .select("creator_profile_id, created_at")
    .eq("follower_profile_id", followerProfileId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data?.length) return [];

  const profiles: PlatformProfile[] = [];
  for (const row of data) {
    const profile = await getProfileById(row.creator_profile_id as string);
    if (profile) profiles.push(profile);
  }
  return profiles;
}

export async function countFollowers(creatorProfileId: string): Promise<number> {
  const supabase = getAdminClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("creator_follows")
    .select("id", { count: "exact", head: true })
    .eq("creator_profile_id", creatorProfileId);

  if (error) return 0;
  return count ?? 0;
}

export async function loadFollowingFeed(
  followerProfileId: string,
  limit = 30,
): Promise<CreatorContent[]> {
  const followed = await listFollowedCreators(followerProfileId);
  if (followed.length === 0) return [];

  const usernames = new Set(followed.map((p) => p.username.toLowerCase()));
  const all = await loadPublishedPostsFromDb();
  return all
    .filter((p) => usernames.has(p.author.toLowerCase()))
    .slice(0, limit);
}

/**
 * Public posts for a username.
 * Matches author_name case-insensitively (legacy rows used "Anonymous" vs "anonymous").
 */
export async function loadPublishedPostsByAuthor(
  username: string,
): Promise<CreatorContent[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const normalized = username.trim().toLowerCase();
  // ilike without wildcards = case-insensitive full-string match in Postgres
  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("status", "published")
    .ilike("author_name", normalized)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[creator-follows] author posts failed:", error.message);
    return [];
  }

  return (data as CreatorPostRow[]).map(rowToCreatorContent);
}

/** Wallets linked to a platform profile (publisher + agent). */
export async function listWalletsForProfile(
  profileId: string,
): Promise<string[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("profile_wallets")
    .select("wallet_address")
    .eq("profile_id", profileId);

  if (error || !data) return [];
  return data
    .map((row) => String(row.wallet_address ?? "").toLowerCase())
    .filter(Boolean);
}

/**
 * All published posts for a profile: by username (case-insensitive) OR
 * connected_wallet linked to that profile. Deduped by post id.
 */
export async function loadPublishedPostsForProfile(
  profile: PlatformProfile,
): Promise<CreatorContent[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const byAuthor = await loadPublishedPostsByAuthor(profile.username);
  const wallets = await listWalletsForProfile(profile.id);

  let byWallet: CreatorContent[] = [];
  if (wallets.length > 0) {
    const { data, error } = await supabase
      .from("creator_posts")
      .select("*")
      .eq("status", "published")
      .in("connected_wallet", wallets)
      .order("published_at", { ascending: false });

    if (error) {
      console.error("[creator-follows] wallet posts failed:", error.message);
    } else {
      byWallet = (data as CreatorPostRow[]).map(rowToCreatorContent);
    }
  }

  const merged = new Map<string, CreatorContent>();
  for (const post of [...byAuthor, ...byWallet]) {
    merged.set(post.id, post);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aT = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bT = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bT - aT;
  });
}

const USERNAME_AUTHOR = /^[a-z0-9_]{3,24}$/;

export type PublisherRecommendation = {
  username: string;
  postCount: number;
  totalReaders: number;
  latestTitle: string | null;
  latestPublishedAt: string | null;
  following: boolean;
};

/**
 * Recommend publishers who have at least one published post.
 * Excludes the viewer and optionally ranks followed last (or filters them out).
 */
export async function listPublisherRecommendations(options?: {
  viewerProfileId?: string | null;
  /** When true, still include already-followed creators with following=true. */
  includeFollowing?: boolean;
  limit?: number;
}): Promise<PublisherRecommendation[]> {
  const limit = options?.limit ?? 24;
  const includeFollowing = options?.includeFollowing ?? true;
  const posts = await loadPublishedPostsFromDb();

  type Acc = {
    username: string;
    postCount: number;
    totalReaders: number;
    latestTitle: string | null;
    latestPublishedAt: string | null;
  };

  const byAuthor = new Map<string, Acc>();
  for (const post of posts) {
    // Normalize so "Anonymous" and "anonymous" count as one publisher.
    const username = post.author.trim().toLowerCase();
    if (!USERNAME_AUTHOR.test(username)) continue;

    const prior = byAuthor.get(username);
    const publishedAt = post.publishedAt ?? null;
    if (!prior) {
      byAuthor.set(username, {
        username,
        postCount: 1,
        totalReaders: post.paidCount ?? 0,
        latestTitle: post.title,
        latestPublishedAt: publishedAt,
      });
      continue;
    }

    prior.postCount += 1;
    prior.totalReaders += post.paidCount ?? 0;
    if (
      publishedAt &&
      (!prior.latestPublishedAt ||
        new Date(publishedAt).getTime() > new Date(prior.latestPublishedAt).getTime())
    ) {
      prior.latestPublishedAt = publishedAt;
      prior.latestTitle = post.title;
    }
  }

  // Only accounts that exist as platform profiles (real usernames).
  const candidates: Acc[] = [];
  for (const acc of byAuthor.values()) {
    const profile = await getProfileByUsername(acc.username);
    if (!profile) continue;
    if (options?.viewerProfileId && profile.id === options.viewerProfileId) {
      continue;
    }
    candidates.push(acc);
  }

  candidates.sort((a, b) => {
    if (b.totalReaders !== a.totalReaders) return b.totalReaders - a.totalReaders;
    if (b.postCount !== a.postCount) return b.postCount - a.postCount;
    return a.username.localeCompare(b.username);
  });

  const followedIds = new Set<string>();
  if (options?.viewerProfileId) {
    const followed = await listFollowedCreators(options.viewerProfileId);
    for (const p of followed) followedIds.add(p.username.toLowerCase());
  }

  const rows: PublisherRecommendation[] = [];
  for (const acc of candidates) {
    const following = followedIds.has(acc.username);
    if (following && !includeFollowing) continue;
    rows.push({
      username: acc.username,
      postCount: acc.postCount,
      totalReaders: acc.totalReaders,
      latestTitle: acc.latestTitle,
      latestPublishedAt: acc.latestPublishedAt,
      following,
    });
    if (rows.length >= limit) break;
  }

  // Surface unfollowed first for discovery, then following.
  rows.sort((a, b) => {
    if (a.following !== b.following) return a.following ? 1 : -1;
    if (b.totalReaders !== a.totalReaders) return b.totalReaders - a.totalReaders;
    return a.username.localeCompare(b.username);
  });

  return rows;
}
