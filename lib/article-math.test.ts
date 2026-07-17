import { describe, expect, it } from "vitest";
import { latexToPlain, plainMathInFootnoteDefinitions } from "@/lib/article-math";

describe("latexToPlain", () => {
  it("expands the stress-test fee ratio", () => {
    const plain = latexToPlain(
      "\\frac{0.30 + 0.029 \\times 0.001}{0.001} \\approx 300",
    );
    expect(plain).toBe("(0.30 + 0.029 × 0.001)/(0.001) ≈ 300");
  });
});

describe("plainMathInFootnoteDefinitions", () => {
  it("converts math only on footnote definition lines", () => {
    const md = `Body has $E=mc^2$ and cites[^1].

[^1]: Effective fee ratio: $\\frac{0.30 + 0.029 \\times 0.001}{0.001} \\approx 300$. Card rails were never built for this.
[^2]: The attestation contract charges a flat 0.1 USDC.
`;
    const out = plainMathInFootnoteDefinitions(md);
    expect(out).toContain("Body has $E=mc^2$");
    expect(out).toContain(
      "[^1]: Effective fee ratio: (0.30 + 0.029 × 0.001)/(0.001) ≈ 300. Card rails were never built for this.",
    );
    expect(out).toContain("[^2]: The attestation contract charges a flat 0.1 USDC.");
    expect(out).not.toMatch(/\[\^1\]:.*\\frac/);
  });

  it("is a no-op when there are no footnotes", () => {
    const md = "Just $x^2$ in the body.";
    expect(plainMathInFootnoteDefinitions(md)).toBe(md);
  });
});
