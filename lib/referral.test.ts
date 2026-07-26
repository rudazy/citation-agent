import { describe, expect, it } from "vitest";
import {
  REFERRAL_QUERY_PARAM,
  appendReferralToPath,
  getReferralFromSearchParams,
  normalizeReferralCode,
  stripReferral,
  withReferral,
} from "@/lib/referral";

describe("referral codes", () => {
  it("normalizes a username-shaped code", () => {
    expect(normalizeReferralCode("  Alice  ")).toBe("alice");
  });

  it("rejects non-usernames and non-strings", () => {
    expect(normalizeReferralCode("a")).toBeNull();
    expect(normalizeReferralCode("has spaces")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode(42)).toBeNull();
  });

  it("reads a code off search params", () => {
    const params = new URLSearchParams(`${REFERRAL_QUERY_PARAM}=Alice`);
    expect(getReferralFromSearchParams(params)).toBe("alice");
    expect(getReferralFromSearchParams(new URLSearchParams())).toBeNull();
  });
});

describe("withReferral", () => {
  it("adds a code to a bare path", () => {
    expect(withReferral("/r/post-1", "alice")).toBe("/r/post-1?ref=alice");
  });

  it("appends to an existing query", () => {
    expect(withReferral("/marketplace?post=abc", "alice")).toBe(
      "/marketplace?post=abc&ref=alice",
    );
  });

  it("replaces rather than stacks an existing code", () => {
    const once = withReferral("/r/post-1", "alice");
    const twice = withReferral(once, "bob");
    expect(twice).toBe("/r/post-1?ref=bob");
    expect(twice.match(/ref=/g)).toHaveLength(1);
  });

  it("keeps the hash fragment after the query", () => {
    expect(withReferral("/marketplace#publish-signal", "alice")).toBe(
      "/marketplace?ref=alice#publish-signal",
    );
  });

  it("leaves the url untouched for an invalid code", () => {
    expect(withReferral("/r/post-1", "!!")).toBe("/r/post-1");
  });

  it("works on absolute urls", () => {
    expect(withReferral("https://agentcitation.xyz/u/alice", "bob")).toBe(
      "https://agentcitation.xyz/u/alice?ref=bob",
    );
  });
});

describe("stripReferral", () => {
  it("removes the code but keeps other params", () => {
    expect(stripReferral("/marketplace?post=abc&ref=alice")).toBe(
      "/marketplace?post=abc",
    );
  });

  it("drops the query entirely when only a code was present", () => {
    expect(stripReferral("/r/post-1?ref=alice")).toBe("/r/post-1");
  });

  it("is a no-op without a query", () => {
    expect(stripReferral("/r/post-1")).toBe("/r/post-1");
  });
});

describe("appendReferralToPath", () => {
  it("attaches a code to an unlock path that already has a query", () => {
    expect(appendReferralToPath("/api/marketplace/citations?id=p1", "alice")).toBe(
      "/api/marketplace/citations?id=p1&ref=alice",
    );
  });

  it("returns the path unchanged when there is no usable code", () => {
    const path = "/api/marketplace/citations?id=p1";
    expect(appendReferralToPath(path, null)).toBe(path);
    expect(appendReferralToPath(path, undefined)).toBe(path);
    expect(appendReferralToPath(path, "!!")).toBe(path);
  });

  it("encodes the code it appends", () => {
    expect(appendReferralToPath("/api/x", "alice_1")).toBe(
      "/api/x?ref=alice_1",
    );
  });
});
