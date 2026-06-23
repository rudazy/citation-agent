import { describe, expect, it } from "vitest";
import { MIN_POST_PRICE_USDC } from "./creator-post-constants";
import { defaultAuthorName, makePostId, parsePriceUsdc, validatePublishInput } from "./creator-posts";

const CONNECTED = "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62" as const;

describe("creator-posts", () => {
  it("generates stable slug ids with suffix", () => {
    const id = makePostId("Hello World Post");
    expect(id).toMatch(/^hello-world-post-[a-f0-9]{8}$/);
  });

  it("formats default author name from wallet", () => {
    expect(defaultAuthorName(CONNECTED)).toBe("Creator 0x60c0...5c62");
  });

  it("parses price strings and numbers", () => {
    expect(parsePriceUsdc("0.001")).toBe(0.001);
    expect(parsePriceUsdc(2.5)).toBe(2.5);
    expect(parsePriceUsdc("bad")).toBeNull();
  });

  it("enforces minimum price and required fields", () => {
    const base = {
      title: "Test title",
      subheading: "Public teaser for readers",
      body: "This is the paywalled body with enough length.",
      priceUsdc: "0.001",
      connectedWallet: CONNECTED,
    };

    expect(validatePublishInput(base)).toBeNull();

    expect(
      validatePublishInput({ ...base, priceUsdc: "0.0005" }),
    ).toContain(String(MIN_POST_PRICE_USDC));

    expect(validatePublishInput({ ...base, title: "ab" })).toContain("Title");
    expect(
      validatePublishInput({ ...base, payoutWallet: "0xbad" }),
    ).toContain("Payout");
  });
});