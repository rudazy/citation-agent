import { describe, expect, it } from "vitest";
import { validateDraftInput } from "@/lib/creator-drafts";
import { MAX_POST_BODY_CHARS, MIN_POST_PRICE_USDC } from "@/lib/creator-post-constants";

const CONNECTED = "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62" as const;

describe("creator-drafts", () => {
  it("allows incomplete drafts with username", () => {
    expect(
      validateDraftInput({
        title: "",
        body: "",
        username: "alpha_reader",
        connectedWallet: CONNECTED,
      }),
    ).toBeNull();
  });

  it("requires a valid username", () => {
    expect(
      validateDraftInput({
        title: "WIP",
        username: "ab",
        connectedWallet: CONNECTED,
      }),
    ).toContain("Username");
  });

  it("enforces body soft cap", () => {
    expect(
      validateDraftInput({
        body: "x".repeat(MAX_POST_BODY_CHARS + 1),
        username: "alpha_reader",
        connectedWallet: CONNECTED,
      }),
    ).toContain("characters or fewer");
  });

  it("enforces price floor when price is provided", () => {
    expect(
      validateDraftInput({
        priceUsdc: "0.0001",
        username: "alpha_reader",
        connectedWallet: CONNECTED,
      }),
    ).toContain(String(MIN_POST_PRICE_USDC));
  });
});
