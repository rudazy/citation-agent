import { describe, expect, it } from "vitest";
import {
  DISPUTE_WINDOW_HOURS,
  MIN_DISPUTE_STAKE_USDC,
  canDispute,
  deriveResolutionState,
  disputeWindowEndsAtMs,
  isSignalOutcome,
  isSufficientDisputeStake,
  resolutionDisputeTarget,
  signalExpiryMs,
  summarizeDeskAccuracy,
  validateResolutionNote,
  type ResolutionRecord,
} from "@/lib/signal-resolution";

const NOW = new Date("2026-07-26T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function resolution(over: Partial<ResolutionRecord> = {}): ResolutionRecord {
  return {
    outcome: "right",
    // Default: window still open relative to NOW.
    disputeWindowEndsAt: "2026-07-27T12:00:00Z",
    ...over,
  };
}

describe("outcome + target helpers", () => {
  it("validates outcomes", () => {
    expect(isSignalOutcome("right")).toBe(true);
    expect(isSignalOutcome("void")).toBe(true);
    expect(isSignalOutcome("maybe")).toBe(false);
    expect(isSignalOutcome(null)).toBe(false);
  });

  it("builds a canonical dispute target", () => {
    expect(resolutionDisputeTarget(" post-1 ")).toBe("resolution:post-1");
  });

  it("computes the dispute window from the resolve time", () => {
    const start = NOW.getTime();
    expect(disputeWindowEndsAtMs(start) - start).toBe(
      DISPUTE_WINDOW_HOURS * 60 * 60 * 1000,
    );
  });
});

describe("signalExpiryMs", () => {
  const published = "2026-07-01T00:00:00Z";
  const publishedMs = new Date(published).getTime();

  it("expires fixed horizons", () => {
    expect(signalExpiryMs(published, "30d")).toBe(publishedMs + 30 * DAY);
    expect(signalExpiryMs(published, "90d")).toBe(publishedMs + 90 * DAY);
  });

  it("never expires event or open horizons", () => {
    expect(signalExpiryMs(published, "event")).toBeNull();
    expect(signalExpiryMs(published, "open")).toBeNull();
  });

  it("returns null for missing or unparseable input", () => {
    expect(signalExpiryMs(null, "30d")).toBeNull();
    expect(signalExpiryMs(published, null)).toBeNull();
    expect(signalExpiryMs("not-a-date", "30d")).toBeNull();
  });
});

describe("deriveResolutionState", () => {
  it("is unresolved before the horizon passes", () => {
    const state = deriveResolutionState(
      { publishedAt: "2026-07-20T00:00:00Z", horizon: "30d" },
      NOW,
    );
    expect(state.status).toBe("unresolved");
    expect(state.overdue).toBe(false);
    expect(state.countsTowardAccuracy).toBe(false);
  });

  it("is expired_unresolved once the horizon passes with no outcome", () => {
    const state = deriveResolutionState(
      { publishedAt: "2026-01-01T00:00:00Z", horizon: "30d" },
      NOW,
    );
    expect(state.status).toBe("expired_unresolved");
    expect(state.overdue).toBe(true);
  });

  it("never marks an open-horizon signal overdue", () => {
    const state = deriveResolutionState(
      { publishedAt: "2020-01-01T00:00:00Z", horizon: "open" },
      NOW,
    );
    expect(state.status).toBe("unresolved");
    expect(state.overdue).toBe(false);
  });

  it("is provisional inside the dispute window and does not count yet", () => {
    const state = deriveResolutionState({ resolution: resolution() }, NOW);
    expect(state.status).toBe("provisional");
    expect(state.countsTowardAccuracy).toBe(false);
    expect(state.effectiveOutcome).toBe("right");
  });

  it("becomes final once the window closes undisputed", () => {
    const state = deriveResolutionState(
      { resolution: resolution({ disputeWindowEndsAt: "2026-07-25T12:00:00Z" }) },
      NOW,
    );
    expect(state.status).toBe("final");
    expect(state.countsTowardAccuracy).toBe(true);
  });

  it("is excluded from accuracy while disputed", () => {
    const state = deriveResolutionState(
      {
        resolution: resolution({
          disputeWindowEndsAt: "2026-07-25T12:00:00Z",
          disputedAt: "2026-07-24T00:00:00Z",
        }),
      },
      NOW,
    );
    expect(state.status).toBe("disputed");
    expect(state.countsTowardAccuracy).toBe(false);
  });

  it("marks an adjudicated dispute upheld when the outcome stands", () => {
    const state = deriveResolutionState(
      {
        resolution: resolution({
          disputedAt: "2026-07-24T00:00:00Z",
          adjudicatedAt: "2026-07-25T00:00:00Z",
          adjudicatedOutcome: "right",
        }),
      },
      NOW,
    );
    expect(state.status).toBe("adjudicated");
    expect(state.adjudication).toBe("upheld");
    expect(state.effectiveOutcome).toBe("right");
    expect(state.countsTowardAccuracy).toBe(true);
  });

  it("overturns and uses the adjudicated outcome", () => {
    const state = deriveResolutionState(
      {
        resolution: resolution({
          outcome: "right",
          disputedAt: "2026-07-24T00:00:00Z",
          adjudicatedAt: "2026-07-25T00:00:00Z",
          adjudicatedOutcome: "wrong",
        }),
      },
      NOW,
    );
    expect(state.adjudication).toBe("overturned");
    expect(state.effectiveOutcome).toBe("wrong");
    expect(state.countsTowardAccuracy).toBe(true);
  });
});

describe("canDispute", () => {
  it("allows a challenge inside the window", () => {
    expect(canDispute(resolution(), NOW)).toBe(true);
  });

  it("refuses once the window closes or a dispute exists", () => {
    expect(
      canDispute(resolution({ disputeWindowEndsAt: "2026-07-25T12:00:00Z" }), NOW),
    ).toBe(false);
    expect(canDispute(resolution({ disputedAt: "2026-07-25T00:00:00Z" }), NOW)).toBe(
      false,
    );
  });

  it("refuses when there is no resolution", () => {
    expect(canDispute(null, NOW)).toBe(false);
  });
});

describe("isSufficientDisputeStake", () => {
  it("accepts the minimum and above", () => {
    expect(isSufficientDisputeStake(MIN_DISPUTE_STAKE_USDC)).toBe(true);
    expect(isSufficientDisputeStake("0.100000")).toBe(true);
    expect(isSufficientDisputeStake("5")).toBe(true);
  });

  it("rejects below minimum and garbage", () => {
    expect(isSufficientDisputeStake("0.05")).toBe(false);
    expect(isSufficientDisputeStake("nope")).toBe(false);
  });
});

describe("validateResolutionNote", () => {
  it("treats blank as null and trims otherwise", () => {
    expect(validateResolutionNote("  ")).toEqual({ ok: true, note: null });
    expect(validateResolutionNote(" invalidated ")).toEqual({
      ok: true,
      note: "invalidated",
    });
  });

  it("rejects overlong and non-text notes", () => {
    expect(validateResolutionNote("x".repeat(501)).ok).toBe(false);
    expect(validateResolutionNote(12).ok).toBe(false);
  });
});

describe("summarizeDeskAccuracy", () => {
  const final = (outcome: "right" | "wrong" | "void") => ({
    resolution: resolution({
      outcome,
      disputeWindowEndsAt: "2026-07-20T00:00:00Z",
    }),
    publishedAt: "2026-07-01T00:00:00Z",
    horizon: "30d" as const,
  });

  it("counts only settled outcomes toward accuracy", () => {
    const summary = summarizeDeskAccuracy(
      [final("right"), final("right"), final("wrong")],
      NOW,
    );
    expect(summary.scored).toBe(3);
    expect(summary.accuracyPct).toBeCloseTo(66.7, 1);
  });

  it("excludes void from the accuracy denominator", () => {
    const summary = summarizeDeskAccuracy([final("right"), final("void")], NOW);
    expect(summary.scored).toBe(2);
    expect(summary.voided).toBe(1);
    expect(summary.accuracyPct).toBe(100);
  });

  it("does not score provisional or disputed signals", () => {
    const summary = summarizeDeskAccuracy(
      [
        { resolution: resolution(), publishedAt: "2026-07-25T00:00:00Z", horizon: "30d" },
        {
          resolution: resolution({
            disputeWindowEndsAt: "2026-07-20T00:00:00Z",
            disputedAt: "2026-07-19T00:00:00Z",
          }),
          publishedAt: "2026-07-01T00:00:00Z",
          horizon: "30d",
        },
      ],
      NOW,
    );
    expect(summary.scored).toBe(0);
    expect(summary.provisional).toBe(1);
    expect(summary.disputed).toBe(1);
    expect(summary.accuracyPct).toBeNull();
  });

  // The core anti-gaming property: burying a loser by never resolving it is
  // visible in the resolution rate rather than silently improving accuracy.
  it("penalises unresolved expired signals in the resolution rate", () => {
    const summary = summarizeDeskAccuracy(
      [
        final("right"),
        { publishedAt: "2026-01-01T00:00:00Z", horizon: "30d" },
        { publishedAt: "2026-01-01T00:00:00Z", horizon: "30d" },
      ],
      NOW,
    );
    expect(summary.accuracyPct).toBe(100);
    expect(summary.expiredUnresolved).toBe(2);
    expect(summary.resolutionRatePct).toBeCloseTo(33.3, 1);
  });

  it("ignores signals that are not yet due", () => {
    const summary = summarizeDeskAccuracy(
      [{ publishedAt: "2026-07-25T00:00:00Z", horizon: "30d" }],
      NOW,
    );
    expect(summary.resolutionRatePct).toBeNull();
    expect(summary.expiredUnresolved).toBe(0);
  });

  it("returns empty figures with no signals", () => {
    const summary = summarizeDeskAccuracy([], NOW);
    expect(summary.scored).toBe(0);
    expect(summary.accuracyPct).toBeNull();
    expect(summary.resolutionRatePct).toBeNull();
  });
});
