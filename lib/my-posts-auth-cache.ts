import { PUBLISH_AUTH_MAX_AGE_MS } from "@/lib/publish-auth";
import { myPostsHeaders, type MyPostsAuth } from "@/lib/publish-client";

const CACHE_KEY = "citation-agent:my-posts-auth-v1";
const CACHE_BUFFER_MS = 60_000;

type CachedMyPostsAuth = MyPostsAuth & { cachedAt: number };

export function cacheMyPostsAuth(auth: MyPostsAuth): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: CachedMyPostsAuth = { ...auth, cachedAt: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode or quota — catalog can still use linked-wallet server access.
  }
}

/** Reuse a recent my-posts signature for catalog reads (no replay consumption). */
export function getCachedMyPostsCatalogHeaders(
  address: `0x${string}` | null | undefined,
): Record<string, string> {
  if (!address || typeof sessionStorage === "undefined") return {};

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};

    const cached = JSON.parse(raw) as CachedMyPostsAuth;
    if (cached.address?.toLowerCase() !== address.toLowerCase()) return {};

    const signedAt = Number(cached.timestamp);
    if (!Number.isFinite(signedAt)) return {};

    const maxAge = PUBLISH_AUTH_MAX_AGE_MS - CACHE_BUFFER_MS;
    if (Math.abs(Date.now() - signedAt) > maxAge) return {};
    if (Date.now() - cached.cachedAt > maxAge) return {};

    return myPostsHeaders(cached);
  } catch {
    return {};
  }
}