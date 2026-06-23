import { describe, expect, it } from "vitest";
import { selectTrustForPost } from "./trust-display";
import {
  formatTrustLabel,
  paidScoreToSignal,
  trustScoreToSignal,
  type PublicTrustSignal,
} from "./creator-trust";

// Two posts owned by different identity wallets. The first has a paid TrustGate
// score; the second's wallet returns 402 on the free path (no signal of its own).
const POST_A = "trustgate-6fce0630";
const POST_B = "england-vs-ghana-f82dd21f";

const paidSignalForA = paidScoreToSignal(
  { score: 92, tier: "HIGH_ELITE", recommendation: "INSTANT_PRIORITY" },
  POST_A,
);

describe("selectTrustForPost (per-post binding)", () => {
  it("shows a signal only on the exact post it was fetched for", () => {
    expect(selectTrustForPost(POST_A, paidSignalForA)).toBe(paidSignalForA);
  });

  it("never shows one post's paid score on a different post's card", () => {
    // Post B must not render Post A's 92/HIGH_ELITE, even if A's signal somehow
    // reaches B's render path. The leak the bug report describes is impossible.
    expect(selectTrustForPost(POST_B, paidSignalForA)).toBeNull();
    expect(formatTrustLabel(selectTrustForPost(POST_B, paidSignalForA))).toBeNull();
  });

  it("fails closed for an unstamped (legacy/foreign) signal", () => {
    const unstamped = {
      score: 92,
      tier: "HIGH_ELITE",
      recommendation: "INSTANT_PRIORITY",
      confidence: 0,
      source: "paid",
    } as PublicTrustSignal;
    expect(selectTrustForPost(POST_B, unstamped)).toBeNull();
  });

  it("renders Unscored for a 402 wallet even when another card holds a cached paid score", () => {
    // Simulates the cards' trust state: A holds a cached paid score, B has none
    // (its wallet returned 402 on the free path, so the server signal is null).
    const trustStates: Record<string, PublicTrustSignal | null> = {
      [POST_A]: paidSignalForA,
      [POST_B]: trustScoreToSignal(null, "free", POST_B), // 402 -> null
    };

    const shownA = selectTrustForPost(POST_A, trustStates[POST_A]);
    const shownB = selectTrustForPost(POST_B, trustStates[POST_B]);

    expect(formatTrustLabel(shownA)).toBe("92 · HIGH_ELITE · INSTANT_PRIORITY");
    expect(shownB).toBeNull(); // -> card shows the "Unscored" badge
    expect(formatTrustLabel(shownB)).toBeNull();
  });

  it("does not show a paid score on B even after B is force-fed A's cached value", () => {
    // Worst case: A's signal is written under B's key in client state.
    const trustStates: Record<string, PublicTrustSignal | null> = {
      [POST_B]: paidSignalForA,
    };
    expect(selectTrustForPost(POST_B, trustStates[POST_B])).toBeNull();
  });
});
