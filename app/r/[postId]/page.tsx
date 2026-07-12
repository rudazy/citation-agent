import type { Metadata } from "next";
import { ReportLanding } from "@/components/marketplace/report-landing";
import { getCreatorContentById } from "@/lib/citations";
import { isPublicResearchListing } from "@/lib/catalog-filter";
import { resolveSiteOrigin } from "@/lib/site-url";
import { buildReportPath } from "@/lib/profile-url";
import { formatUsernameDisplay } from "@/lib/username";

type Props = { params: Promise<{ postId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId: raw } = await params;
  const postId = decodeURIComponent(raw ?? "").trim();
  const content = postId ? await getCreatorContentById(postId) : null;
  const visible =
    content && isPublicResearchListing(content) ? content : null;

  const title = visible
    ? `${visible.title} — Citation Agent`
    : "Research report — Citation Agent";
  const description = visible
    ? `${visible.subheading.slice(0, 180)} · $${visible.priceUsdc} USDC · by ${
        visible.source === "database"
          ? formatUsernameDisplay(visible.author)
          : visible.author
      }`
    : "Paywalled crypto research on Citation Agent.";
  const path = buildReportPath(postId || "unknown");
  const origin = resolveSiteOrigin();

  return {
    title,
    description,
    alternates: { canonical: `${origin}${path}` },
    openGraph: {
      title,
      description,
      url: `${origin}${path}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const { postId: raw } = await params;
  const postId = decodeURIComponent(raw ?? "").trim();
  return <ReportLanding postId={postId} />;
}
