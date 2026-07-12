import { getProfileByUsername, type PlatformProfile } from "@/lib/platform-profile";
import {
  countFollowers,
  loadPublishedPostsForProfile,
} from "@/lib/creator-follows";
import type { CreatorContent } from "@/lib/citations";
import { isPublicResearchListing } from "@/lib/catalog-filter";

export type PublicProfilePost = {
  id: string;
  title: string;
  subheading: string;
  priceUsdc: string;
  tags: string[];
  paidCount: number;
  publishedAt?: string;
};

export type PublicCreatorProfile = {
  username: string;
  createdAt: string;
  followerCount: number;
  postCount: number;
  totalReaders: number;
  posts: PublicProfilePost[];
};

function toPublicPost(post: CreatorContent): PublicProfilePost {
  return {
    id: post.id,
    title: post.title,
    subheading: post.subheading,
    priceUsdc: post.priceUsdc,
    tags: post.tags,
    paidCount: post.paidCount,
    publishedAt: post.publishedAt,
  };
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
  const followerCount = await countFollowers(profile.id);
  const totalReaders = posts.reduce((sum, p) => sum + (p.paidCount ?? 0), 0);

  return {
    username: profile.username,
    createdAt: profile.createdAt,
    followerCount,
    postCount: posts.length,
    totalReaders,
    posts: posts.map(toPublicPost),
  };
}

export async function resolveCreatorProfile(
  username: string,
): Promise<PlatformProfile | null> {
  return getProfileByUsername(username);
}
