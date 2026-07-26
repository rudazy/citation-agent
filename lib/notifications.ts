import { getAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "follow"
  | "comment"
  | "reply"
  | "sale"
  | "endorsement"
  | "curator_credit"
  | "publish_research"
  | "publish_signal";

export type NotificationRow = {
  id: string;
  created_at: string;
  type: NotificationType;
  actor_username: string | null;
  post_id: string | null;
  read_at: string | null;
};

/**
 * Best-effort insert — notification failures must never fail the action
 * (follow, comment, sale) that triggered them.
 */
export async function createNotification(params: {
  profileId: string;
  type: NotificationType;
  actorUsername?: string | null;
  postId?: string | null;
}): Promise<void> {
  const supabase = getAdminClient();
  if (!supabase) return;

  const { error } = await supabase.from("notifications").insert({
    profile_id: params.profileId,
    type: params.type,
    actor_username: params.actorUsername?.trim().toLowerCase() || null,
    post_id: params.postId ?? null,
  });
  if (error) {
    console.warn("[notifications] insert failed:", error.message);
  }
}

export async function listNotifications(
  profileId: string,
  limit = 30,
): Promise<NotificationRow[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, created_at, type, actor_username, post_id, read_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[notifications] list failed:", error.message);
    return [];
  }
  return (data ?? []) as NotificationRow[];
}

export async function countUnreadNotifications(profileId: string): Promise<number> {
  const supabase = getAdminClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("read_at", null);

  if (error) {
    console.warn("[notifications] unread count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markAllNotificationsRead(profileId: string): Promise<void> {
  const supabase = getAdminClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("read_at", null);

  if (error) {
    console.warn("[notifications] mark read failed:", error.message);
  }
}

/** Human line for a notification row (shared by the bell dropdown). */
export function notificationText(row: NotificationRow): string {
  const actor = row.actor_username ? `@${row.actor_username}` : "Someone";
  switch (row.type) {
    case "follow":
      return `${actor} started following you`;
    case "comment":
      return `${actor} commented on your report`;
    case "reply":
      return `${actor} replied to your comment`;
    case "sale":
      return "Your report was unlocked — you earned a royalty";
    case "endorsement":
      return `${actor} endorsed your work`;
    case "curator_credit":
      return "An unlock you routed earned you curator credit";
    case "publish_research":
      return `${actor} published new research`;
    case "publish_signal":
      return `${actor} published a new signal`;
    default:
      return "New activity";
  }
}

/**
 * Fan out a publish notification to a creator's followers.
 *
 * Best-effort and bounded: a single batched insert, capped so a desk with a
 * large following cannot stall the publish request that triggered it.
 */
export async function notifyFollowersOfPublish(params: {
  creatorProfileId: string;
  creatorUsername: string;
  postId: string;
  postKind: "research" | "signal";
  limit?: number;
}): Promise<number> {
  const supabase = getAdminClient();
  if (!supabase) return 0;

  const limit = params.limit ?? 500;
  const { data, error } = await supabase
    .from("creator_follows")
    .select("follower_profile_id")
    .eq("creator_profile_id", params.creatorProfileId)
    .limit(limit);

  if (error) {
    console.warn("[notifications] follower lookup failed:", error.message);
    return 0;
  }

  const followerIds = [
    ...new Set((data ?? []).map((row) => String(row.follower_profile_id))),
  ].filter((id) => id && id !== params.creatorProfileId);
  if (followerIds.length === 0) return 0;

  const type: NotificationType =
    params.postKind === "signal" ? "publish_signal" : "publish_research";
  const actor = params.creatorUsername.trim().toLowerCase() || null;

  const { error: insertError } = await supabase.from("notifications").insert(
    followerIds.map((profileId) => ({
      profile_id: profileId,
      type,
      actor_username: actor,
      post_id: params.postId,
    })),
  );

  if (insertError) {
    console.warn("[notifications] publish fan-out failed:", insertError.message);
    return 0;
  }
  return followerIds.length;
}
