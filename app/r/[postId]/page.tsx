import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ReportLanding } from "@/components/marketplace/report-landing";
import { ReferralCapture } from "@/components/marketplace/referral-capture";
import { getPostMetaById, loadPublishedPostIds } from "@/lib/creator-posts";

type Props = { params: Promise<{ postId: string }> };

/**
 * Enumerate live posts at build so the cached per-post metadata can execute
 * during prerender. Posts published after the deploy render on demand.
 */
export async function generateStaticParams(): Promise<Array<{ postId: string }>> {
  try {
    const ids = await loadPublishedPostIds();
    return ids.map((postId) => ({ postId }));
  } catch {
    return [];
  }
}

/**
 * Per-report meta: title, teaser, and the cover as the OG/Twitter card image.
 * Cache Components requires prerenderable metadata on this route: the whole
 * function is cached with params as the cache key (awaited inside), and the
 * lookup is time-free because cached scopes cannot read the current time.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  "use cache";
  const { postId: raw } = await params;
  const postId = decodeURIComponent(raw ?? "").trim();
  const post = postId ? await getPostMetaById(postId) : null;
  if (!post) return {};

  const description = post.subheading.slice(0, 200);
  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
    twitter: {
      card: post.coverImageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}),
    },
  };
}

/**
 * Marks the route as intentionally dynamic under Cache Components so parent
 * file-based metadata (opengraph-image, etc.) does not fail prerender.
 */
async function DynamicMarker() {
  await connection();
  return null;
}

async function ReportBody({ params }: Props) {
  const { postId: raw } = await params;
  const postId = decodeURIComponent(raw ?? "").trim();
  return <ReportLanding postId={postId} />;
}

export default function ReportPage({ params }: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <Suspense fallback={null}>
        <ReportBody params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <DynamicMarker />
      </Suspense>
    </>
  );
}
