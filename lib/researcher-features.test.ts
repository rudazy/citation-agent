import { describe, expect, it } from "vitest";
import {
  MAX_SCHEDULE_AHEAD_MS,
  validateCoverImageUrl,
  validateScheduledFor,
} from "@/lib/creator-posts";
import { canonicalPublishPayload, publishPayloadDigest } from "@/lib/publish-payload";
import { validateProofUrl } from "@/lib/profile-verification";
import { referrerHostFrom, viewerHash } from "@/lib/post-views";

describe("cover image validation", () => {
  it("accepts https URLs and rejects everything else", () => {
    expect(validateCoverImageUrl("https://cdn.example.com/cover.png")).toBeNull();
    expect(validateCoverImageUrl("http://example.com/x.png")).toMatch(/https/);
    expect(validateCoverImageUrl("not a url")).toMatch(/valid https/);
    expect(validateCoverImageUrl(`https://e.com/${"a".repeat(500)}`)).toMatch(/too long/);
  });
});

describe("scheduled publishing validation", () => {
  const now = Date.parse("2026-07-17T00:00:00Z");

  it("requires a future time within 90 days", () => {
    expect(validateScheduledFor(now + 60_000, now)).toBeNull();
    expect(validateScheduledFor(now - 1, now)).toMatch(/future/);
    expect(validateScheduledFor(now + MAX_SCHEDULE_AHEAD_MS + 1, now)).toMatch(/90 days/);
    expect(validateScheduledFor(Number.NaN, now)).toMatch(/Invalid/);
  });
});

describe("publish payload digest backward compatibility", () => {
  const base = {
    title: "T",
    subheading: "Sub",
    body: "Body",
    priceUsdc: "0.5",
    tags: ["b", "a"],
  };

  it("produces the pre-cover digest when no cover is set", () => {
    // Adding the optional cover field must not change signatures of coverless posts.
    expect(canonicalPublishPayload(base)).toBe(
      canonicalPublishPayload({ ...base, coverImageUrl: "" }),
    );
    expect(canonicalPublishPayload(base)).not.toContain("cover_image_url");
  });

  it("binds the cover into the digest when present", () => {
    const withCover = publishPayloadDigest({
      ...base,
      coverImageUrl: "https://e.com/a.png",
    });
    expect(withCover).not.toBe(publishPayloadDigest(base));
    expect(
      canonicalPublishPayload({ ...base, coverImageUrl: "https://e.com/a.png" }),
    ).toContain("cover_image_url");
  });
});

describe("proof URL SSRF guard", () => {
  it("accepts normal https pages", () => {
    expect(validateProofUrl("https://you.substack.com/about").ok).toBe(true);
  });

  it("rejects http, IPs, localhost, ports, credentials, and bare hosts", () => {
    for (const bad of [
      "http://example.com",
      "https://127.0.0.1/x",
      "https://[::1]/x",
      "https://localhost/x",
      "https://internal.local/x",
      "https://example.com:8443/x",
      "https://user:pass@example.com/x",
      "https://intranet/x",
    ]) {
      expect(validateProofUrl(bad).ok, bad).toBe(false);
    }
  });
});

describe("view tracking hygiene", () => {
  it("hashes sessions per day, irreversibly and stably", () => {
    const a = viewerHash("session-1", "2026-07-17");
    expect(a).toBe(viewerHash("session-1", "2026-07-17"));
    expect(a).not.toBe(viewerHash("session-1", "2026-07-18"));
    expect(a).not.toContain("session-1");
    expect(a).toHaveLength(32);
  });

  it("stores only the referrer hostname", () => {
    expect(referrerHostFrom("https://x.com/someone/status/1?a=b")).toBe("x.com");
    expect(referrerHostFrom("not a url")).toBeNull();
    expect(referrerHostFrom("")).toBeNull();
  });
});
