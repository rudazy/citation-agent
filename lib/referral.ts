/**
 * Referral attribution (Phase 2) — pure link and code helpers.
 *
 * A curator shares a post with `?ref=<their-username>`. The landing page stores
 * the code in a first-party cookie, and the unlock request carries it back as a
 * query param so both unlock paths work: the MetaMask path fetches the endpoint
 * directly, while the agent path proxies through /api/gateway/pay server-side
 * (where cookies do not propagate but the query string does).
 */

import { normalizeUsernameInput } from "@/lib/username";

export const REFERRAL_QUERY_PARAM = "ref";
export const REFERRAL_COOKIE = "ca_ref";

/** Referral credit window. Long enough to survive a read-then-buy gap. */
export const REFERRAL_TTL_SECONDS = 30 * 24 * 60 * 60;

/** A referral code is just a platform username; returns null when invalid. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return normalizeUsernameInput(raw);
}

export function getReferralFromSearchParams(
  params: URLSearchParams | { get(name: string): string | null },
): string | null {
  return normalizeReferralCode(params.get(REFERRAL_QUERY_PARAM));
}

/** Append `?ref=` to a share URL, replacing any code already present. */
export function withReferral(url: string, username: string): string {
  const ref = normalizeReferralCode(username);
  if (!ref) return url;

  // Strip first so the separator is derived from what actually remains: a URL
  // whose only param was a stale ref must go back to "?" rather than "&".
  const [base, hash = ""] = splitHash(stripReferral(url));
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${REFERRAL_QUERY_PARAM}=${encodeURIComponent(ref)}${hash}`;
}

/** Remove an existing `ref` param so codes never stack on a re-share. */
export function stripReferral(url: string): string {
  const [base, hash = ""] = splitHash(url);
  const queryIndex = base.indexOf("?");
  if (queryIndex === -1) return `${base}${hash}`;

  const path = base.slice(0, queryIndex);
  const params = new URLSearchParams(base.slice(queryIndex + 1));
  params.delete(REFERRAL_QUERY_PARAM);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash}`;
}

function splitHash(url: string): [string, string] {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return [url, ""];
  return [url.slice(0, hashIndex), url.slice(hashIndex)];
}

/**
 * Attach a referral code to an in-app unlock path. Returns the path unchanged
 * when the code is missing or malformed — attribution never blocks an unlock.
 */
export function appendReferralToPath(
  path: string,
  ref: string | null | undefined,
): string {
  const code = normalizeReferralCode(ref);
  if (!code) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${REFERRAL_QUERY_PARAM}=${encodeURIComponent(code)}`;
}
