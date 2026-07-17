import { describe, expect, it } from "vitest";
import {
  insertFootnote,
  nextFootnoteNumber,
  prefixSelectedLines,
  wrapSelection,
} from "@/lib/article-format";

describe("wrapSelection", () => {
  it("wraps selected text and keeps it selected", () => {
    const r = wrapSelection("make this bold now", 5, 9, "**", "**", "text");
    expect(r.next).toBe("make **this** bold now");
    expect(r.next.slice(r.selStart, r.selEnd)).toBe("this");
  });

  it("inserts a selected placeholder when nothing is selected", () => {
    const r = wrapSelection("", 0, 0, "**", "**", "bold text");
    expect(r.next).toBe("**bold text**");
    expect(r.next.slice(r.selStart, r.selEnd)).toBe("bold text");
  });
});

describe("prefixSelectedLines", () => {
  it("prefixes the current line for a caret selection", () => {
    const value = "first line\nsecond line";
    const caret = value.indexOf("second") + 2;
    const r = prefixSelectedLines(value, caret, caret, "## ");
    expect(r.next).toBe("first line\n## second line");
  });

  it("prefixes every line in a multi-line selection", () => {
    const value = "a\nb\nc";
    const r = prefixSelectedLines(value, 0, value.length, "- ");
    expect(r.next).toBe("- a\n- b\n- c");
  });
});

describe("footnotes", () => {
  it("starts at 1 in a fresh document", () => {
    expect(nextFootnoteNumber("no notes here")).toBe(1);
  });

  it("continues after the highest existing marker", () => {
    expect(nextFootnoteNumber("a[^1] b[^2]\n\n[^1]: x\n[^2]: y")).toBe(3);
  });

  it("inserts a reference at the cursor and a definition at the end", () => {
    const value = "claim needs a source";
    const r = insertFootnote(value, value.length, value.length);
    expect(r.next).toContain("claim needs a source[^1]");
    expect(r.next).toMatch(/\[\^1\]: Source or note here\.$/);
    expect(r.next.slice(r.selStart, r.selEnd)).toBe("Source or note here.");
  });
});
