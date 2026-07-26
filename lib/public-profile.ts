import { getProfileByUsername, type PlatformProfile } from "@/lib/platform-profile";
import {
  countFollowers,
  loadPublishedPostsForProfile,
} from "@/lib/creator-follows";
import { loadMarkdownContent, type CreatorContent } from "@/lib/citations";
import { getPostSummariesByIds } from "@/lib/creator-posts";
import { isPublicResearchListing } from "@/lib/catalog-filter";
import {
  getEndorsementSummariesForPosts,
  listEndorsementsByProfile,
} from "@/lib/endorsements";
import { getResolutionsForPosts } from "@/lib/signal-resolution-store";
import {
  EMPTY_DESK_ACCURACY,
  deriveResolutionState,
  summarizeDeskAccuracy,
  type DeskAccuracy,
  type ResolutionStatus,
  type SignalOutcome,
} from "@/lib/signal-resolution";

export type PublicProfilePost = {
  id: string;
  title: string;
  subheading: string;
  priceUsdc: string;
  tags: string[];
  paidCount: number;
  publishedAt?: string;
  postKind: "research" | "signal";
  endorsementCount: number;
  endorsedBy: string[];
  /** Signals only: outcome state once a resolution has been filed. */
  resolutionStatus?: ResolutionStatus;
  resolutionOutcome?: SignalOutcome | null;
  signalDirection?: CreatorContent["signalDirection"];
  signalConfidence?: number;
  signalHorizon?: CreatorContent["signalHorizon"];
  signalInvalidation?: string;
};

/** A post this desk has stamped — the curation half of a Creator Desk. */
export type PublicProfileCuration = {
  postId: string;
  title: string;
  author: string;
  priceUsdc: string;
  postKind: "research" | "signal";
  note: string | null;
  createdAt: string;
};

export type PublicCreatorProfile = {
  username: string;
  createdAt: string;
  followerCount: number;
  postCount: number;
  signalCount: number;
  totalReaders: number;
  /** Stamps this desk has received across its own work. */
  endorsementsReceived: number;
  /** Stamps this desk has given to other creators. */
  endorsementsGiven: number;
  /** Proof of judgment: settled signal outcomes and whether the desk closes the loop. */
  accuracy: DeskAccuracy;
  posts: PublicProfilePost[];
  curation: PublicProfileCuration[];
};

function toPublicPost(
  post: CreatorContent,
  endorsements: { count: number; topEndorsers: string[] },
  resolutionState?: ReturnType<typeof deriveResolutionState>,
): PublicProfilePost {
  const postKind = post.postKind === "signal" ? "signal" : "research";
  return {
    id: post.id,
    title: post.title,
    subheading: post.subheading,
    priceUsdc: post.priceUsdc,
    tags: post.tags,
    paidCount: post.paidCount,
    publishedAt: post.publishedAt,
    postKind,
    endorsementCount: endorsements.count,
    endorsedBy: endorsements.topEndorsers,
    ...(postKind === "signal"
      ? {
          resolutionStatus: resolutionState?.status ?? "unresolved",
          resolutionOutcome: resolutionState?.effectiveOutcome ?? null,
          signalDirection: post.signalDirection,
          signalConfidence: post.signalConfidence,
          signalHorizon: post.signalHorizon,
          signalInvalidation: post.signalInvalidation,
        }
      : {}),
  };
}

/**
 * Resolve stamped post ids to card metadata. Published posts come from a single
 * bulk query; seed listings live in content files, so fall back to those.
 */
async function loadCuration(
  profileId: string,
): Promise<PublicProfileCuration[]> {
  const stamps = await listEndorsementsByProfile(profileId);
  if (stamps.length === 0) return [];

  const summaries = await getPostSummariesByIds(stamps.map((s) => s.postId));
  const seeds = new Map(loadMarkdownContent().map((post) => [post.id, post]));

  return stamps
    .map((stamp) => {
      const summary = summaries.get(stamp.postId);
      const seed = summary ? null : seeds.get(stamp.postId);
      if (!summary && !seed) return null;

      return {
        postId: stamp.postId,
        title: summary?.title ?? seed!.title,
        author: summary?.author ?? seed!.author,
        priceUsdc: summary?.priceUsdc ?? seed!.priceUsdc,
        postKind: (summary?.postKind ?? seed!.postKind ?? "research") === "signal"
          ? ("signal" as const)
          : ("research" as const),
        note: stamp.note,
        createdAt: stamp.createdAt,
      };
    })
    .filter((row): row is PublicProfileCuration => row !== null);
}

export async function getPublicCreatorProfile(
  username: string,
): Promise<PublicCreatorProfile | null> {
  const profile = await getProfileByUsername(username);
  if (!profile) return null;

  // Case-insensitive author_name + posts from wallets linked to this profile
  // (legacy rows stored "Anonymous" while username is "anonymous").
  const posts = (await loadPublishedPostsForProfile(profile)).filter(
    isPublicResearchListing,
  );
  const signals = posts.filter((p) => p.postKind === "signal");

  const [followerCount, endorsementIndex, curation, resolutions] = await Promise.all([
    countFollowers(profile.id),
    getEndorsementSummariesForPosts(posts.map((p) => p.id)),
    loadCuration(profile.id),
    getResolutionsForPosts(signals.map((p) => p.id)),
  ]);

  const totalReaders = posts.reduce((sum, p) => sum + (p.paidCount ?? 0), 0);
  const signalCount = signals.length;
  const researchCount = posts.length - signalCount;

  const publicPosts = posts.map((post) =>
    toPublicPost(
      post,
      endorsementIndex.get(post.id) ?? { count: 0, topEndorsers: [] },
      post.postKind === "signal"
        ? deriveResolutionState({
            resolution: resolutions.get(post.id) ?? null,
            publishedAt: post.publishedAt,
            horizon: post.signalHorizon,
          })
        : undefined,
    ),
  );

  const accuracy = signalCount
    ? summarizeDeskAccuracy(
        signals.map((post) => ({
          resolution: resolutions.get(post.id) ?? null,
          publishedAt: post.publishedAt,
          horizon: post.signalHorizon,
        })),
      )
    : EMPTY_DESK_ACCURACY;

  return {
    username: profile.username,
    createdAt: profile.createdAt,
    followerCount,
    postCount: researchCount,
    signalCount,
    totalReaders,
    endorsementsReceived: publicPosts.reduce(
      (sum, p) => sum + p.endorsementCount,
      0,
    ),
    endorsementsGiven: curation.length,
    accuracy,
    posts: publicPosts,
    curation,
  };
}

export async function resolveCreatorProfile(
  username: string,
): Promise<PlatformProfile | null> {
  return getProfileByUsername(username);
}
