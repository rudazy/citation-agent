import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ReportLanding } from "@/components/marketplace/report-landing";
import { getPublishedPostById } from "@/lib/creator-posts";

type Props = { params: Promise<{ postId: string }> };

/** Per-report meta: title, teaser, and the cover as the OG/Twitter card image. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId: raw } = await params;
  const postId = decodeURIComponent(raw ?? "").trim();
  const post = postId ? await getPublishedPostById(postId) : null;
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
        <ReportBody params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <DynamicMarker />
      </Suspense>
    </>
  );
}
