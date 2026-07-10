import { describe, expect, it } from "vitest";
import {
  DEFAULT_MERMAID_TEMPLATE,
  MERMAID_MAX_CHARS,
  bodyHasMermaidFence,
  isMermaidLanguageClass,
  mermaidMarkdownAtCursor,
  validateMermaidSource,
} from "./article-mermaid";

describe("article-mermaid", () => {
  it("detects mermaid fenced-code class names", () => {
    expect(isMermaidLanguageClass("language-mermaid")).toBe(true);
    expect(isMermaidLanguageClass("language-mmd")).toBe(true);
    expect(isMermaidLanguageClass("language-mermaid hljs")).toBe(true);
    expect(isMermaidLanguageClass("language-js")).toBe(false);
    expect(isMermaidLanguageClass(undefined)).toBe(false);
    expect(isMermaidLanguageClass("")).toBe(false);
  });

  it("validates source length and emptiness", () => {
    expect(validateMermaidSource("")).toContain("empty");
    expect(validateMermaidSource("   ")).toContain("empty");
    expect(validateMermaidSource("flowchart TD\n  A-->B")).toBeNull();
    expect(validateMermaidSource("x".repeat(MERMAID_MAX_CHARS + 1))).toContain(
      "characters or fewer",
    );
  });

  it("builds a fenced mermaid markdown snippet", () => {
    const snippet = mermaidMarkdownAtCursor();
    expect(snippet).toContain("```mermaid");
    expect(snippet).toContain(DEFAULT_MERMAID_TEMPLATE);
    expect(snippet.endsWith("\n\n")).toBe(true);
  });

  it("allows a custom chart body in the fence", () => {
    expect(mermaidMarkdownAtCursor("sequenceDiagram\n  A->>B: hi")).toBe(
      "\n\n```mermaid\nsequenceDiagram\n  A->>B: hi\n```\n\n",
    );
  });

  it("detects mermaid fences in body text", () => {
    expect(bodyHasMermaidFence("plain text")).toBe(false);
    expect(bodyHasMermaidFence("```mermaid\nflowchart TD\nA-->B\n```")).toBe(true);
    expect(bodyHasMermaidFence("```mmd\nA-->B")).toBe(true);
  });
});
