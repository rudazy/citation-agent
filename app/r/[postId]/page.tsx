import { Suspense } from "react";
import { connection } from "next/server";
import { ReportLanding } from "@/components/marketplace/report-landing";

type Props = { params: Promise<{ postId: string }> };

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
