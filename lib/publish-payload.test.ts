import { describe, expect, it } from "vitest";
import {
  articleImageUploadDigest,
  canonicalPublishPayload,
  publishPayloadDigest,
  publishPayloadFromBody,
} from "@/lib/publish-payload";

describe("publish-payload", () => {
  it("canonicalizes field order and sorts tags", () => {
    const canonical = canonicalPublishPayload({
      title: " Title ",
      subheading: " Sub ",
      body: "Body text",
      priceUsdc: "0.01",
      tags: ["z", "a"],
      authorName: "Analyst",
      payoutWallet: "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62",
    });

    expect(canonical).toBe(
      JSON.stringify({
        author_name: "Analyst",
        body: "Body text",
        payout_wallet: "0x60c05e2d820ce989e944ed4e7bb33baeb8705c62",
        price_usdc: "0.01",
        subheading: "Sub",
        tags: ["a", "z"],
        title: "Title",
      }),
    );
  });

  it("produces stable digest for equivalent API body shapes", () => {
    const fromSnake = publishPayloadFromBody({
      title: "A",
      subheading: "B",
      body: "C",
      price_usdc: "0.001",
      tags: ["x"],
    });
    const fromCamel = publishPayloadFromBody({
      title: "A",
      subheading: "B",
      body: "C",
      priceUsdc: "0.001",
      tags: ["x"],
    });

    expect(publishPayloadDigest(fromSnake)).toBe(publishPayloadDigest(fromCamel));
  });

  it("binds article image uploads to file metadata", () => {
    const fileA = articleImageUploadDigest({
      mime: "image/png",
      size: 1024,
      filename: "chart.png",
    });
    const fileB = articleImageUploadDigest({
      mime: "image/png",
      size: 2048,
      filename: "chart.png",
    });
    expect(fileA).not.toBe(fileB);
  });

  it("changes digest when body content changes", () => {
    const base = {
      title: "A",
      subheading: "B",
      body: "C",
      priceUsdc: "0.001",
    };
    const first = publishPayloadDigest(base);
    const second = publishPayloadDigest({ ...base, body: "D" });
    expect(first).not.toBe(second);
  });
});