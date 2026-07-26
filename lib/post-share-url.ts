import { buildReportPath, buildReportUrl } from "@/lib/profile-url";

export const POST_SHARE_QUERY_PARAM = "post";

/** Deep-links the catalog to a topic filter (used by the niche discovery lane). */
export const CATALOG_TAG_QUERY_PARAM = "tag";

export function getCatalogTagFromSearchParams(
  params: URLSearchParams | { get(name: string): string | null },
): string | null {
  const raw = params.get(CATALOG_TAG_QUERY_PARAM)?.trim().toLowerCase();
  return raw || null;
}

/** Canonical share path for a research asset (`/r/{id}`). */
export function buildPostSharePath(postId: string): string {
  return buildReportPath(postId);
}

/** Marketplace deep-link that expands a post in the catalog. */
export function buildMarketplacePostPath(postId: string): string {
  const encoded = encodeURIComponent(postId.trim());
  return `/marketplace?${POST_SHARE_QUERY_PARAM}=${encoded}`;
}

export function buildPostShareUrl(postId: string, origin: string): string {
  return buildReportUrl(postId, origin);
}

export function getPostIdFromSearchParams(
  params: URLSearchParams | { get(name: string): string | null },
): string | null {
  const raw = params.get(POST_SHARE_QUERY_PARAM)?.trim();
  return raw || null;
}

export async function copyPostShareLink(postId: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("copyPostShareLink requires a browser environment");
  }
  const url = buildPostShareUrl(postId, window.location.origin);
  await navigator.clipboard.writeText(url);
  return url;
}