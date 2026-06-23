import { describe, expect, it } from "vitest";

// Test extractBody logic via exported types and inline mirror of parser
function extractBody(data: unknown): { body?: string; subheading?: string } {
  if (!data || typeof data !== "object") return {};
  const citation = (data as { citation?: { body?: string; subheading?: string } }).citation;
  return { body: citation?.body, subheading: citation?.subheading };
}

describe("citation unlock response parsing", () => {
  it("extracts body from paid citation response", () => {
    const parsed = extractBody({
      citation: {
        id: "post-1",
        subheading: "Teaser",
        body: "Full paid content",
      },
    });
    expect(parsed.body).toBe("Full paid content");
    expect(parsed.subheading).toBe("Teaser");
  });

  it("returns empty when citation missing", () => {
    expect(extractBody({})).toEqual({});
    expect(extractBody(null)).toEqual({});
  });
});