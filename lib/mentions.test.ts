import { describe, expect, it } from "vitest";
import { extractMentionUsernames, parseMentionSegments } from "@/lib/mentions";

describe("mentions", () => {
  it("parses plain text without mentions", () => {
    expect(parseMentionSegments("hello world")).toEqual([
      { type: "text", value: "hello world" },
    ]);
  });

  it("extracts @username mentions as links", () => {
    const segments = parseMentionSegments("see @alice_desk and @bob");
    expect(segments).toEqual([
      { type: "text", value: "see " },
      {
        type: "mention",
        value: "@alice_desk",
        username: "alice_desk",
        href: "/u/alice_desk",
      },
      { type: "text", value: " and " },
      {
        type: "mention",
        value: "@bob",
        username: "bob",
        href: "/u/bob",
      },
    ]);
  });

  it("lists unique usernames", () => {
    expect(extractMentionUsernames("@Alpha_One says hi to @alpha_one and @beta")).toEqual([
      "alpha_one",
      "beta",
    ]);
  });
});
