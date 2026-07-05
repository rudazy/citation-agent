import { describe, expect, it } from "vitest";
import { buildCommentTree } from "./comment-tree";

describe("buildCommentTree", () => {
  it("nests replies under parent comments", () => {
    const tree = buildCommentTree([
      {
        id: "a",
        postId: "p1",
        parentId: null,
        username: "alpha",
        body: "root",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "b",
        postId: "p1",
        parentId: "a",
        username: "beta",
        body: "reply",
        createdAt: "2026-01-01T00:01:00Z",
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
    expect(tree[0].replies).toHaveLength(1);
    expect(tree[0].replies[0].id).toBe("b");
  });
});