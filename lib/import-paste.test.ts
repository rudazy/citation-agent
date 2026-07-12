import { describe, expect, it } from "vitest";
import { parseImportPaste } from "@/lib/import-paste";

describe("import-paste", () => {
  it("uses first markdown heading as title", () => {
    const parsed = parseImportPaste(
      "# Hyperliquid fees\n\nPublic teaser paragraph.\n\n## Body\n\nFull analysis here.",
    );
    expect(parsed.title).toBe("Hyperliquid fees");
    expect(parsed.subheading).toContain("Public teaser");
    expect(parsed.body).toContain("Full analysis");
  });

  it("falls back to first line when no heading", () => {
    const parsed = parseImportPaste("Untitled notes\n\nTeaser line.\n\nBody text.");
    expect(parsed.title).toBe("Untitled notes");
    expect(parsed.subheading).toContain("Teaser");
    expect(parsed.body).toContain("Body text");
  });
});
