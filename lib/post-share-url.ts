export const POST_SHARE_QUERY_PARAM = "post";

export function buildPostSharePath(postId: string): string {
  const encoded = encodeURIComponent(postId.trim());
  return `/marketplace?${POST_SHARE_QUERY_PARAM}=${encoded}`;
}

export function buildPostShareUrl(postId: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildPostSharePath(postId)}`;
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