import { describe, expect, it } from "vitest";
import type { CreatorContent } from "@/lib/citations";
import { canCommentOnPost } from "./post-comments";

const PUBLISHER = "0x33e27d6dc287B1EA58865DDD9cF9460a53224134" as const;

function makePost(): CreatorContent {
  return {
    id: "test-post",
    title: "Test",
    author: "glenn",
    connectedWallet: PUBLISHER,
    payoutWallet: PUBLISHER,
    priceUsdc: "0.001",
    tags: [],
    subheading: "Teaser",
    body: "Body",
    paidCount: 0,
    source: "database",
  };
}

describe("canCommentOnPost", () => {
  it("allows the post publisher without a prior unlock payment", async () => {
    const viewer = new Set([PUBLISHER.toLowerCase()]);
    await expect(canCommentOnPost(makePost(), viewer)).resolves.toBe(true);
  });

  it("denies viewers with no wallet identity", async () => {
    await expect(canCommentOnPost(makePost(), new Set())).resolves.toBe(false);
  });
});