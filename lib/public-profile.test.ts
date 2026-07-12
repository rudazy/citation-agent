import { describe, expect, it } from "vitest";

/**
 * Regression notes for profile post loading:
 * - author_name "Anonymous" vs username "anonymous" must both match
 * - profile uses loadPublishedPostsForProfile (ilike + linked wallets)
 */

describe("public-profile post matching", () => {
  it("documents case-insensitive author equality", () => {
    const legacy = "Anonymous";
    const username = "anonymous";
    expect(legacy.toLowerCase()).toBe(username);
    expect(legacy === username).toBe(false);
  });
});
