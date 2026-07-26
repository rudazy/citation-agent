import { NextResponse, type NextRequest } from "next/server";
import { getPublicCreatorProfile } from "@/lib/public-profile";
import { getProfileByWallet, getProfileByUsername } from "@/lib/platform-profile";
import { isFollowing } from "@/lib/creator-follows";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { formatUsernameDisplay, normalizeUsernameInput } from "@/lib/username";
import { buildProfilePath, buildReportPath } from "@/lib/profile-url";
import {
  getBackingSummariesForTargets,
} from "@/lib/attestation-index";
import {
  authorBackingTarget,
  indexBackingSummaries,
  type ResearchBackingStats,
} from "@/lib/research-backing";

type RouteContext = { params: Promise<{ username: string }> };

/**
 * Public creator profile — teasers only.
 * Reading/unlock happens in the marketplace catalog via View.
 * Includes on-chain researcher backing for author:{username}.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { username: raw } = await context.params;
  const username = normalizeUsernameInput(raw ?? "");
  if (!username) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const profile = await getPublicCreatorProfile(username);
  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  let following = false;
  let isSelf = false;
  let verifiedLinks: string[] = [];
  const agent = await resolveUserAgent();
  const creator = await getProfileByUsername(profile.username);
  if (agent) {
    const viewer = await getProfileByWallet(agent.address);
    if (viewer && creator) {
      isSelf = viewer.id === creator.id;
      if (!isSelf) {
        following = await isFollowing(viewer.id, creator.id);
      }
    }
  }

  if (creator) {
    try {
      const { getVerifiedKindsForProfile } = await import("@/lib/profile-verification");
      verifiedLinks = await getVerifiedKindsForProfile(creator.id);
    } catch (err) {
      console.warn("[profiles] verification lookup failed:", err);
    }
  }

  // Match catalog / profile Back target: author:{username}
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  const backingTarget = authorBackingTarget(profile.username);
  let researcherBacking: ResearchBackingStats | null = null;
  try {
    const rows = await getBackingSummariesForTargets([backingTarget], {
      forceOnChain: forceRefresh,
    });
    const index = indexBackingSummaries(rows);
    researcherBacking = index.get(backingTarget) ?? null;
  } catch (err) {
    console.warn(
      "[profiles] researcher backing lookup failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json({
    username: profile.username,
    displayName: formatUsernameDisplay(profile.username),
    profilePath: buildProfilePath(profile.username),
    createdAt: profile.createdAt,
    followerCount: profile.followerCount,
    postCount: profile.postCount,
    signalCount: profile.signalCount,
    totalReaders: profile.totalReaders,
    endorsementsReceived: profile.endorsementsReceived,
    endorsementsGiven: profile.endorsementsGiven,
    accuracy: {
      scored: profile.accuracy.scored,
      right: profile.accuracy.right,
      wrong: profile.accuracy.wrong,
      voided: profile.accuracy.voided,
      accuracy_pct: profile.accuracy.accuracyPct,
      provisional: profile.accuracy.provisional,
      disputed: profile.accuracy.disputed,
      expired_unresolved: profile.accuracy.expiredUnresolved,
      resolution_rate_pct: profile.accuracy.resolutionRatePct,
    },
    curation: profile.curation.map((c) => ({
      post_id: c.postId,
      title: c.title,
      author: c.author,
      price_usdc: c.priceUsdc,
      post_kind: c.postKind,
      note: c.note,
      created_at: c.createdAt,
      path: buildReportPath(c.postId),
    })),
    following,
    isSelf,
    verified_links: verifiedLinks,
    researcher_backing: researcherBacking,
    posts: profile.posts.map((p) => ({
      id: p.id,
      title: p.title,
      author: profile.username,
      subheading: p.subheading,
      price_usdc: p.priceUsdc,
      tags: p.tags,
      paid_count: p.paidCount,
      published_at: p.publishedAt ?? null,
      path: buildReportPath(p.id),
      post_kind: p.postKind,
      endorsement_count: p.endorsementCount,
      endorsed_by: p.endorsedBy,
      resolution_status: p.resolutionStatus ?? null,
      resolution_outcome: p.resolutionOutcome ?? null,
      signal_direction: p.signalDirection ?? null,
      signal_confidence: p.signalConfidence ?? null,
      signal_horizon: p.signalHorizon ?? null,
      signal_invalidation: p.signalInvalidation ?? null,
    })),
  });
}
