import { describe, expect, it } from "vitest";
import {
  ENDORSEMENT_NOTE_MAX_LEN,
  ENDORSEMENT_PREVIEW_LIMIT,
  getEndorsementSummary,
  summarizeEndorsements,
  validateEndorsementNote,
} from "@/lib/endorsements";

describe("validateEndorsementNote", () => {
  it("treats an absent or blank note as null", () => {
    expect(validateEndorsementNote(undefined)).toEqual({ ok: true, note: null });
    expect(validateEndorsementNote("")).toEqual({ ok: true, note: null });
    expect(validateEndorsementNote("   ")).toEqual({ ok: true, note: null });
  });

  it("trims a usable note", () => {
    expect(validateEndorsementNote("  best call this cycle  ")).toEqual({
      ok: true,
      note: "best call this cycle",
    });
  });

  it("rejects a note past the length cap", () => {
    const result = validateEndorsementNote("x".repeat(ENDORSEMENT_NOTE_MAX_LEN + 1));
    expect(result.ok).toBe(false);
  });

  it("accepts a note exactly at the cap", () => {
    const result = validateEndorsementNote("x".repeat(ENDORSEMENT_NOTE_MAX_LEN));
    expect(result).toEqual({
      ok: true,
      note: "x".repeat(ENDORSEMENT_NOTE_MAX_LEN),
    });
  });

  it("rejects non-text notes", () => {
    expect(validateEndorsementNote(42).ok).toBe(false);
    expect(validateEndorsementNote({ note: "hi" }).ok).toBe(false);
  });
});

describe("summarizeEndorsements", () => {
  const rows = [
    { post_id: "p1", username: "alice", created_at: "2026-07-01T00:00:00Z" },
    { post_id: "p1", username: "bob", created_at: "2026-07-03T00:00:00Z" },
    { post_id: "p1", username: "carol", created_at: "2026-07-02T00:00:00Z" },
    { post_id: "p2", username: "dave", created_at: "2026-07-04T00:00:00Z" },
  ];

  it("counts stamps per post", () => {
    const index = summarizeEndorsements(rows);
    expect(index.get("p1")?.count).toBe(3);
    expect(index.get("p2")?.count).toBe(1);
  });

  it("previews endorsers newest first", () => {
    const index = summarizeEndorsements(rows);
    expect(index.get("p1")?.topEndorsers).toEqual(["bob", "carol", "alice"]);
  });

  it("caps the preview at the display limit", () => {
    const many = Array.from({ length: ENDORSEMENT_PREVIEW_LIMIT + 4 }, (_, i) => ({
      post_id: "p1",
      username: `user${i}`,
      created_at: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    }));
    const summary = summarizeEndorsements(many).get("p1");
    expect(summary?.count).toBe(ENDORSEMENT_PREVIEW_LIMIT + 4);
    expect(summary?.topEndorsers).toHaveLength(ENDORSEMENT_PREVIEW_LIMIT);
  });

  it("returns an empty index for no rows", () => {
    expect(summarizeEndorsements([]).size).toBe(0);
  });
});

describe("getEndorsementSummary", () => {
  it("falls back to an empty summary for unstamped posts", () => {
    const index = summarizeEndorsements([
      { post_id: "p1", username: "alice", created_at: "2026-07-01T00:00:00Z" },
    ]);
    expect(getEndorsementSummary(index, "missing")).toEqual({
      count: 0,
      topEndorsers: [],
    });
    expect(getEndorsementSummary(index, "p1").count).toBe(1);
  });
});
