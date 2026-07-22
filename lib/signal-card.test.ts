import { describe, expect, it } from "vitest";
import {
  buildDeskShareText,
  buildSignalShareText,
  isPostKind,
  isSignalDirection,
  parseSignalConfidence,
  validateSignalFields,
} from "@/lib/signal-card";

describe("signal-card", () => {
  it("accepts valid signal fields", () => {
    expect(
      validateSignalFields({
        direction: "long",
        confidence: 4,
        horizon: "90d",
        invalidation: "Breaks $2k support on daily close",
      }),
    ).toBeNull();
  });

  it("rejects incomplete signal fields", () => {
    expect(
      validateSignalFields({
        direction: "long",
        confidence: 4,
        horizon: "90d",
        invalidation: "short",
      }),
    ).toContain("Invalidation");

    expect(
      validateSignalFields({
        direction: "up",
        confidence: 4,
        horizon: "90d",
        invalidation: "Breaks support level clearly",
      }),
    ).toContain("direction");

    expect(parseSignalConfidence(0)).toBeNull();
    expect(parseSignalConfidence(3)).toBe(3);
    expect(isSignalDirection("watch")).toBe(true);
    expect(isPostKind("signal")).toBe(true);
    expect(isPostKind("article")).toBe(false);
  });

  it("builds outbound share kit strings", () => {
    const signal = buildSignalShareText({
      title: "ETH rotation into L2s",
      username: "alice",
      direction: "long",
      confidence: 4,
      horizon: "90d",
      url: "https://agentcitation.xyz/r/eth-rotation-abc12345",
    });
    expect(signal).toContain("Signal: ETH rotation into L2s");
    expect(signal).toContain("@alice");
    expect(signal).toContain("Long");
    expect(signal).toContain("agentcitation.xyz");

    const desk = buildDeskShareText({
      username: "alice",
      url: "https://agentcitation.xyz/u/alice",
    });
    expect(desk).toContain("Citation Desk: @alice");
    expect(desk).toContain("/u/alice");
  });
});
