import { NextResponse } from "next/server";
import { loadFollowingFeed } from "@/lib/creator-follows";
import { getProfileByWallet } from "@/lib/platform-profile";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { formatUsernameDisplay } from "@/lib/username";
import { buildProfilePath, buildReportPath } from "@/lib/profile-url";
import { isPublicResearchListing } from "@/lib/catalog-filter";

/**
 * GET — recent published posts from creators the viewer follows.
 * Requires agent session + username (same identity as comments/follow).
 */
export async function GET() {
  const agent = await resolveUserAgent();
  if (!agent) {
    return NextResponse.json({
      count: 0,
      posts: [],
      requiresUsername: false,
      agentConfigured: false,
    });
  }

  const profile = await getProfileByWallet(agent.address);
  if (!profile) {
    return NextResponse.json({
      count: 0,
      posts: [],
      requiresUsername: true,
      agentConfigured: true,
    });
  }

  const posts = (await loadFollowingFeed(profile.id, 40)).filter(
    isPublicResearchListing,
  );

  return NextResponse.json({
    count: posts.length,
    requiresUsername: false,
    agentConfigured: true,
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author,
      displayAuthor: formatUsernameDisplay(p.author),
      profilePath: buildProfilePath(p.author),
      path: buildReportPath(p.id),
      price_usdc: p.priceUsdc,
      tags: p.tags,
      subheading: p.subheading,
      paid_count: p.paidCount,
      published_at: p.publishedAt ?? null,
    })),
  });
}
