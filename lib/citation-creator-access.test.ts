import { describe, expect, it } from "vitest";
import type { CreatorContent } from "@/lib/citations";
import {
  getCreatorOwnedPostIds,
  isCreatorOwnedPost,
} from "./citation-creator-access";

const PUBLISHER = "0x33e27d6dc287B1EA58865DDD9cF9460a53224134" as const;
const OTHER = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const;

function makePost(
  partial: Partial<CreatorContent> & Pick<CreatorContent, "id" | "source">,
): CreatorContent {
  return {
    title: "Test",
    author: "author",
    connectedWallet: PUBLISHER,
    payoutWallet: PUBLISHER,
    priceUsdc: "0.01",
    tags: [],
    subheading: "Teaser",
    body: "Full body",
    paidCount: 0,
    ...partial,
  };
}

describe("citation-creator-access", () => {
  it("returns owned database post ids for the publisher wallet", () => {
    const posts = [
      makePost({ id: "mine", source: "database" }),
      makePost({ id: "other", source: "database", connectedWallet: OTHER }),
      makePost({ id: "seed", source: "markdown" }),
    ];
    const viewer = new Set([PUBLISHER.toLowerCase()]);
    expect(getCreatorOwnedPostIds(viewer, posts)).toEqual(new Set(["mine"]));
  });

  it("matches publisher wallet case-insensitively", () => {
    const post = makePost({
      id: "mine",
      source: "database",
      connectedWallet: PUBLISHER.toLowerCase() as `0x${string}`,
    });
    const viewer = new Set([PUBLISHER.toLowerCase()]);
    expect(isCreatorOwnedPost(post, viewer)).toBe(true);
  });

  it("does not treat markdown seeds as owned", () => {
    const post = makePost({ id: "seed", source: "markdown" });
    const viewer = new Set([PUBLISHER.toLowerCase()]);
    expect(isCreatorOwnedPost(post, viewer)).toBe(false);
  });
});