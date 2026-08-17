import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import { buildProfilePath, buildReportPath } from "@/lib/profile-url";

/** Deep-link a stake target to the desk or report it backs, when one exists. */
export function attestationTargetHref(target: string): string | null {
  const t = canonicalizeAttestationTarget(target);
  if (t.startsWith("author:")) {
    const username = t.slice(7).trim();
    return username ? buildProfilePath(username) : null;
  }
  if (t.startsWith("citation:")) {
    const postId = t.slice(9).trim();
    return postId ? buildReportPath(postId) : null;
  }
  return null;
}
