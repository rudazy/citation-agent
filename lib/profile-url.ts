import { normalizeUsernameInput } from "@/lib/username";

/** Public creator profile path: /u/{username} */
export function buildProfilePath(username: string): string {
  const normalized = normalizeUsernameInput(username) ?? username.trim().replace(/^@+/, "").toLowerCase();
  return `/u/${encodeURIComponent(normalized)}`;
}

export function buildProfileUrl(username: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildProfilePath(username)}`;
}

/** Canonical research asset path for sharing and SEO: /r/{postId} */
export function buildReportPath(postId: string): string {
  return `/r/${encodeURIComponent(postId.trim())}`;
}

export function buildReportUrl(postId: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildReportPath(postId)}`;
}
