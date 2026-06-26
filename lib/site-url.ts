export const OFFICIAL_SITE_HOST = "agentcitation.xyz";
export const OFFICIAL_SITE_URL = `https://${OFFICIAL_SITE_HOST}`;

/** Canonical public origin for metadata, share links, and agent payment URLs. */
export function resolveSiteOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  if (process.env.VERCEL_ENV === "production") {
    return OFFICIAL_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}