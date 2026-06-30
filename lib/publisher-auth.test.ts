import { describe, expect, it } from "vitest";
import { myPostsMessage, MY_POSTS_MESSAGE_PREFIX } from "./publisher-auth";

describe("publisher-auth", () => {
  it("builds a timestamped my-posts message", () => {
    expect(myPostsMessage("1710000000000")).toBe(
      `${MY_POSTS_MESSAGE_PREFIX} 1710000000000`,
    );
  });
});