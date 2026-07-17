import { NextResponse } from "next/server";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
} from "@/lib/notifications";
import { getProfileByWallet } from "@/lib/platform-profile";
import { resolveUserAgent } from "@/lib/resolve-user-agent";

/**
 * Resolve the viewer's profile without provisioning anything — a visitor
 * without a wallet/username simply has no notifications yet.
 */
async function resolveViewerProfileId(): Promise<string | null> {
  const agent = await resolveUserAgent();
  if (!agent) return null;
  const profile = await getProfileByWallet(agent.address);
  return profile?.id ?? null;
}

export async function GET() {
  const profileId = await resolveViewerProfileId();
  if (!profileId) {
    return NextResponse.json({ notifications: [], unread: 0 });
  }

  const [notifications, unread] = await Promise.all([
    listNotifications(profileId),
    countUnreadNotifications(profileId),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      createdAt: n.created_at,
      type: n.type,
      actorUsername: n.actor_username,
      postId: n.post_id,
      read: n.read_at != null,
    })),
    unread,
  });
}

export async function POST(request: Request) {
  let action = "";
  try {
    const body = (await request.json()) as { action?: string };
    action = String(body.action ?? "");
  } catch {
    // fall through to invalid action
  }
  if (action !== "mark-read") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const profileId = await resolveViewerProfileId();
  if (!profileId) {
    return NextResponse.json({ ok: true });
  }

  await markAllNotificationsRead(profileId);
  return NextResponse.json({ ok: true });
}
