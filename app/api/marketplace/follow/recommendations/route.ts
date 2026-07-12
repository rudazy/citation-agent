import { NextResponse } from "next/server";
import { listPublisherRecommendations } from "@/lib/creator-follows";
import { getProfileByWallet } from "@/lib/platform-profile";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { formatUsernameDisplay } from "@/lib/username";
import { buildProfilePath } from "@/lib/profile-url";

/**
 * GET — publishers with at least one published report, for Follow discovery.
 * Only platform usernames that have published; no empty accounts.
 */
export async function GET() {
  let viewerProfileId: string | null = null;
  const agent = await resolveUserAgent();
  if (agent) {
    const profile = await getProfileByWallet(agent.address);
    viewerProfileId = profile?.id ?? null;
  }

  const recommendations = await listPublisherRecommendations({
    viewerProfileId,
    includeFollowing: true,
    limit: 30,
  });

  return NextResponse.json({
    count: recommendations.length,
    hasUsername: Boolean(viewerProfileId),
    recommendations: recommendations.map((r) => ({
      username: r.username,
      displayName: formatUsernameDisplay(r.username),
      profilePath: buildProfilePath(r.username),
      postCount: r.postCount,
      totalReaders: r.totalReaders,
      latestTitle: r.latestTitle,
      latestPublishedAt: r.latestPublishedAt,
      following: r.following,
    })),
  });
}
