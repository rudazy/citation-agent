import { describe, expect, it } from "vitest";
import {
  POST_SHARE_QUERY_PARAM,
  buildPostSharePath,
  buildPostShareUrl,
  getPostIdFromSearchParams,
} from "@/lib/post-share-url";

describe("post-share-url", () => {
  it("builds marketplace path with encoded post id", () => {
    expect(buildPostSharePath("solana-agent-payments-a1b2c3d4")).toBe(
      `/marketplace?${POST_SHARE_QUERY_PARAM}=solana-agent-payments-a1b2c3d4`,
    );
  });

  it("encodes special characters in post ids", () => {
    expect(buildPostSharePath("report with spaces")).toBe(
      `/marketplace?${POST_SHARE_QUERY_PARAM}=report%20with%20spaces`,
    );
  });

  it("builds absolute share url from origin", () => {
    expect(
      buildPostShareUrl("btc-miner-treasury-deadbeef", "https://citation.example"),
    ).toBe(
      `https://citation.example/marketplace?${POST_SHARE_QUERY_PARAM}=btc-miner-treasury-deadbeef`,
    );
  });

  it("strips trailing slash from origin", () => {
    expect(buildPostShareUrl("post-1", "https://citation.example/")).toBe(
      `https://citation.example/marketplace?${POST_SHARE_QUERY_PARAM}=post-1`,
    );
  });

  it("reads post id from search params", () => {
    const params = new URLSearchParams("post=hyperliquid-liquidity-abc123");
    expect(getPostIdFromSearchParams(params)).toBe("hyperliquid-liquidity-abc123");
  });

  it("returns null when post param is missing or blank", () => {
    expect(getPostIdFromSearchParams(new URLSearchParams())).toBeNull();
    expect(getPostIdFromSearchParams(new URLSearchParams("post="))).toBeNull();
    expect(getPostIdFromSearchParams(new URLSearchParams("post=%20%20"))).toBeNull();
  });
});