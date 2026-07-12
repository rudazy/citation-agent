import { describe, expect, it } from "vitest";
import {
  POST_SHARE_QUERY_PARAM,
  buildPostSharePath,
  buildPostShareUrl,
  getPostIdFromSearchParams,
} from "@/lib/post-share-url";

describe("post-share-url", () => {
  it("builds canonical report path for share links", () => {
    expect(buildPostSharePath("solana-agent-payments-a1b2c3d4")).toBe(
      "/r/solana-agent-payments-a1b2c3d4",
    );
  });

  it("encodes special characters in post ids", () => {
    expect(buildPostSharePath("report with spaces")).toBe(
      "/r/report%20with%20spaces",
    );
  });

  it("builds absolute share url from origin", () => {
    expect(
      buildPostShareUrl("btc-miner-treasury-deadbeef", "https://citation.example"),
    ).toBe("https://citation.example/r/btc-miner-treasury-deadbeef");
  });

  it("strips trailing slash from origin", () => {
    expect(buildPostShareUrl("post-1", "https://citation.example/")).toBe(
      "https://citation.example/r/post-1",
    );
  });

  it("reads post id from marketplace search params", () => {
    const params = new URLSearchParams("post=hyperliquid-liquidity-abc123");
    expect(getPostIdFromSearchParams(params)).toBe("hyperliquid-liquidity-abc123");
  });

  it("returns null when post param is missing or blank", () => {
    expect(getPostIdFromSearchParams(new URLSearchParams())).toBeNull();
    expect(getPostIdFromSearchParams(new URLSearchParams("post="))).toBeNull();
    expect(getPostIdFromSearchParams(new URLSearchParams("post=%20%20"))).toBeNull();
  });

  it("exports marketplace deep-link query param name", () => {
    expect(POST_SHARE_QUERY_PARAM).toBe("post");
  });
});