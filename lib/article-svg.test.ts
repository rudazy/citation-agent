import { describe, expect, it } from "vitest";
import {
  SVG_MAX_CHARS,
  fenceBareSvgsInMarkdown,
  isSvgDocument,
  isSvgLanguageClass,
  sanitizeSvgSource,
  svgMarkdownAtCursor,
  validateSvgSource,
} from "./article-svg";

const SAMPLE = `<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#000"/></svg>`;

describe("article-svg", () => {
  it("detects svg documents and language classes", () => {
    expect(isSvgDocument(SAMPLE)).toBe(true);
    expect(isSvgDocument(`  ${SAMPLE}  `)).toBe(true);
    expect(isSvgDocument("```svg\n<svg/>\n```")).toBe(false);
    expect(isSvgDocument("hello")).toBe(false);
    expect(isSvgLanguageClass("language-svg")).toBe(true);
    expect(isSvgLanguageClass("language-xml")).toBe(false);
    expect(isSvgLanguageClass("language-js")).toBe(false);
  });

  it("sanitizes scripts and event handlers", () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" onclick="alert(1)"><script>alert(1)</script><rect width="1" height="1"/></svg>`;
    const clean = sanitizeSvgSource(dirty);
    expect(clean).toBeTruthy();
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).toMatch(/<rect/i);
  });

  it("rejects empty or oversized sources", () => {
    expect(validateSvgSource("")).toContain("empty");
    expect(validateSvgSource("not svg")).toContain("valid");
    expect(validateSvgSource("x".repeat(SVG_MAX_CHARS + 1))).toContain("characters");
    expect(validateSvgSource(SAMPLE)).toBeNull();
  });

  it("builds a fenced svg markdown snippet", () => {
    expect(svgMarkdownAtCursor(SAMPLE)).toContain("```svg");
    expect(svgMarkdownAtCursor(SAMPLE)).toContain(SAMPLE);
  });

  it("fences bare svg blocks without touching existing fences", () => {
    const body = `Intro\n\n${SAMPLE}\n\nOutro`;
    const fenced = fenceBareSvgsInMarkdown(body);
    expect(fenced).toContain("```svg");
    expect(fenced).toContain(SAMPLE);

    const already = "```svg\n" + SAMPLE + "\n```";
    expect(fenceBareSvgsInMarkdown(already)).toBe(already);
  });
});
