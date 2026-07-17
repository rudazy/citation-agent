import { describe, expect, it } from "vitest";
import * as publishFormSetup from "@/lib/publish-form-setup";
import { DEFAULT_POST_TAGS, defaultTagsInput, needsUsernameSetup } from "@/lib/publish-form-setup";
import type { ProfileStatus } from "@/lib/profile-client";

function profileWith(overrides: Partial<ProfileStatus>): ProfileStatus {
  return {
    hasProfile: true,
    username: "ludarep",
    displayName: "Ludarep",
    canChangeUsername: true,
    nextChangeAt: null,
    agentConfigured: true,
    payoutWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    tipWallet: null,
    ...overrides,
  };
}

describe("set-once publish form rules", () => {
  it("configured user sees no username field", () => {
    expect(needsUsernameSetup(profileWith({}))).toBe(false);
  });

  it("first-time user sees the username setup once", () => {
    const fresh = profileWith({ hasProfile: false, username: null, displayName: null });
    expect(needsUsernameSetup(fresh)).toBe(true);
    expect(needsUsernameSetup(null)).toBe(true);
  });

  it("exposes no payout-field rule: the publish page has no wallet field in any state", () => {
    // The payout field was removed entirely; publish silently defaults the
    // wallet server-side (lib/publish-payout.ts). Nothing here can re-enable it.
    expect("needsPayoutSetup" in publishFormSetup).toBe(false);
  });
});

describe("default tags", () => {
  it("prefills exactly three catalog-dominant tags", () => {
    expect(DEFAULT_POST_TAGS).toHaveLength(3);
    expect(defaultTagsInput()).toBe("research, defi, onchain");
  });

  it("defaults parse through the publish tag pipeline and stay removable", () => {
    const parse = (value: string) =>
      value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    expect(parse(defaultTagsInput())).toEqual(["research", "defi", "onchain"]);
    // Writer deletes one default and adds a custom tag.
    expect(parse("research, sui")).toEqual(["research", "sui"]);
    // Clearing the field entirely publishes with no tags.
    expect(parse("")).toEqual([]);
  });
});
