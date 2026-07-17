import type { ProfileStatus } from "@/lib/profile-client";

/**
 * Default tags for a new post: the three most common topics in the live
 * catalog (research 44, defi 18, onchain 10 at the time of selection).
 * Writers can remove or replace any of them.
 */
export const DEFAULT_POST_TAGS = ["research", "defi", "onchain"] as const;

export function defaultTagsInput(): string {
  return DEFAULT_POST_TAGS.join(", ");
}

/**
 * Set-once rule: the username form appears in the publish flow only while the
 * user has no username yet; afterwards it is managed on the profile page.
 *
 * The payout wallet has NO publish-page field in any state: a first publish
 * silently defaults it to the signing wallet (see lib/publish-payout.ts) and
 * it is managed on the profile page afterwards.
 */
export function needsUsernameSetup(profile: ProfileStatus | null): boolean {
  return !profile?.username;
}
