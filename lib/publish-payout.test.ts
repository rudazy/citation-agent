import { describe, expect, it } from "vitest";
import { resolvePublishPayout } from "@/lib/publish-payout";

const SIGNER = "0x1111111111111111111111111111111111111111";
const STORED = "0x2222222222222222222222222222222222222222";
const EXPLICIT = "0x3333333333333333333333333333333333333333";

describe("resolvePublishPayout", () => {
  it("first publish with nothing stored silently defaults to the signing wallet", () => {
    const r = resolvePublishPayout({ connectedWallet: SIGNER });
    expect(r.payoutWallet).toBe(SIGNER);
    expect(r.storeAsDefault).toBe(SIGNER);
  });

  it("subsequent publishes reuse the stored default without re-storing", () => {
    const r = resolvePublishPayout({ storedPayout: STORED, connectedWallet: SIGNER });
    expect(r.payoutWallet).toBe(STORED);
    expect(r.storeAsDefault).toBeNull();
  });

  it("explicit API payout wins for the post and becomes the default only when none stored", () => {
    const first = resolvePublishPayout({
      explicitPayout: EXPLICIT,
      connectedWallet: SIGNER,
    });
    expect(first.payoutWallet).toBe(EXPLICIT);
    expect(first.storeAsDefault).toBe(EXPLICIT);

    const later = resolvePublishPayout({
      explicitPayout: EXPLICIT,
      storedPayout: STORED,
      connectedWallet: SIGNER,
    });
    expect(later.payoutWallet).toBe(EXPLICIT);
    expect(later.storeAsDefault).toBeNull();
  });

  it("blank strings behave like absent values", () => {
    const r = resolvePublishPayout({
      explicitPayout: "  ",
      storedPayout: "",
      connectedWallet: SIGNER,
    });
    expect(r.payoutWallet).toBe(SIGNER);
    expect(r.storeAsDefault).toBe(SIGNER);
  });
});
