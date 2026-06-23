import { describe, expect, it } from "vitest";
import { isPublicResearchListing } from "./catalog-filter";

describe("catalog-filter", () => {
  it("allows crypto research listings", () => {
    expect(
      isPublicResearchListing({ id: "hyperliquid-market-share", tags: ["defi", "research"] }),
    ).toBe(true);
  });

  it("blocks legacy infra and smoke listings", () => {
    expect(isPublicResearchListing({ id: "trust-infrastructure", tags: ["trust"] })).toBe(
      false,
    );
    expect(isPublicResearchListing({ id: "e2e-smoke-15-42-39", tags: ["e2e-smoke"] })).toBe(
      false,
    );
    expect(isPublicResearchListing({ id: "england-vs-ghana-f82dd21f", tags: ["World Cup"] })).toBe(
      false,
    );
  });
});