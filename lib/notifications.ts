import { getAdminClient } from "@/lib/supabase/admin";

export type NotificationType = "follow" | "comment" | "reply" | "sale";

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
    default:
      return "New activity";
  }
}
