import { describe, expect, it } from "vitest";
import {
  SLASH_DELAY_MS,
  disputeStage,
  disputeUpheld,
  isSettlementAction,
  settlementForAdjudication,
  settlementReadiness,
  validateBeneficiary,
  type DisputeSettlementState,
} from "./dispute-settlement";

const NOW = Date.UTC(2026, 7, 16, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

function state(over: Partial<DisputeSettlementState> = {}): DisputeSettlementState {
  return {
    disputedAt: iso(NOW - 5 * 86_400_000),
    stakeFrozenAt: null,
    adjudicatedAt: null,
    settledAt: null,
    ...over,
  };
}

describe("settlementForAdjudication", () => {
  it("releases when the adjudication overturns the creator's call", () => {
    expect(settlementForAdjudication("right", "wrong")).toBe("release");
    expect(settlementForAdjudication("wrong", "void")).toBe("release");
    expect(disputeUpheld("right", "wrong")).toBe(true);
  });

  it("slashes when the adjudication upholds the creator's call", () => {
    expect(settlementForAdjudication("right", "right")).toBe("slash");
    expect(settlementForAdjudication("void", "void")).toBe("slash");
    expect(disputeUpheld("right", "right")).toBe(false);
  });

  /**
   * The payout direction and the upheld/overturned label are read off the same
   * comparison on purpose — a public record that says "dispute upheld" while the
   * challenger's stake was slashed would be worse than no record at all.
   */
  it("never disagrees with the upheld/overturned label", () => {
    const outcomes = ["right", "wrong", "void"] as const;
    for (const original of outcomes) {
      for (const adjudicated of outcomes) {
        const action = settlementForAdjudication(original, adjudicated);
        expect(action === "release").toBe(disputeUpheld(original, adjudicated));
      }
    }
  });

  it("recognises only real settlement actions", () => {
    expect(isSettlementAction("release")).toBe(true);
    expect(isSettlementAction("slash")).toBe(true);
    expect(isSettlementAction("refund")).toBe(false);
    expect(isSettlementAction(null)).toBe(false);
  });
});

describe("disputeStage", () => {
  it("walks the queue in order", () => {
    expect(disputeStage(state({ disputedAt: null }))).toBe("none");
    expect(disputeStage(state())).toBe("awaiting_freeze");
    expect(disputeStage(state({ stakeFrozenAt: iso(NOW) }))).toBe("frozen");
    expect(
      disputeStage(state({ stakeFrozenAt: iso(NOW), adjudicatedAt: iso(NOW) })),
    ).toBe("awaiting_settlement");
    expect(
      disputeStage(
        state({ stakeFrozenAt: iso(NOW), adjudicatedAt: iso(NOW), settledAt: iso(NOW) }),
      ),
    ).toBe("settled");
  });

  it("reports awaiting_settlement even if the stake was never frozen", () => {
    // A release needs no freeze, so this is a legitimate path, not a gap.
    expect(disputeStage(state({ adjudicatedAt: iso(NOW) }))).toBe(
      "awaiting_settlement",
    );
  });
});

describe("settlementReadiness", () => {
  const base = { originalOutcome: "right" as const, nowMs: NOW };

  it("refuses before adjudication", () => {
    const r = settlementReadiness({
      ...base,
      state: state(),
      adjudicatedOutcome: null,
    });
    expect(r).toEqual({ ok: false, reason: "Adjudicate the dispute first" });
  });

  it("allows release immediately, with no freeze required", () => {
    const r = settlementReadiness({
      ...base,
      state: state({ adjudicatedAt: iso(NOW) }),
      adjudicatedOutcome: "wrong",
    });
    expect(r).toEqual({ ok: true, action: "release" });
  });

  it("blocks a slash that was never frozen", () => {
    const r = settlementReadiness({
      ...base,
      state: state({ adjudicatedAt: iso(NOW) }),
      adjudicatedOutcome: "right",
    });
    expect(r).toEqual({
      ok: false,
      reason: "Freeze the stake before slashing",
    });
  });

  it("blocks a slash inside the 24h delay and reports the wait", () => {
    const r = settlementReadiness({
      ...base,
      state: state({
        stakeFrozenAt: iso(NOW - 60 * 60 * 1000),
        adjudicatedAt: iso(NOW),
      }),
      adjudicatedOutcome: "right",
    });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ reason: expect.stringContaining("23h") });
  });

  it("allows a slash once the delay has elapsed", () => {
    const r = settlementReadiness({
      ...base,
      state: state({
        stakeFrozenAt: iso(NOW - SLASH_DELAY_MS),
        adjudicatedAt: iso(NOW),
      }),
      adjudicatedOutcome: "right",
    });
    expect(r).toEqual({ ok: true, action: "slash" });
  });

  it("refuses to settle twice", () => {
    const r = settlementReadiness({
      ...base,
      state: state({
        stakeFrozenAt: iso(NOW - SLASH_DELAY_MS),
        adjudicatedAt: iso(NOW),
        settledAt: iso(NOW),
      }),
      adjudicatedOutcome: "right",
    });
    expect(r).toEqual({ ok: false, reason: "Stake already settled" });
  });

  it("refuses when there is no dispute at all", () => {
    const r = settlementReadiness({
      ...base,
      state: state({ disputedAt: null }),
      adjudicatedOutcome: "right",
    });
    expect(r).toEqual({ ok: false, reason: "No dispute to settle" });
  });

  it("treats an unparseable freeze timestamp as no freeze", () => {
    const r = settlementReadiness({
      ...base,
      state: state({ stakeFrozenAt: "not-a-date", adjudicatedAt: iso(NOW) }),
      adjudicatedOutcome: "right",
    });
    expect(r).toEqual({ ok: false, reason: "Freeze the stake before slashing" });
  });
});

describe("validateBeneficiary", () => {
  it("ignores a beneficiary on release", () => {
    expect(validateBeneficiary("release", undefined)).toEqual({
      ok: true,
      beneficiary: null,
    });
  });

  it("requires a real address on slash", () => {
    expect(validateBeneficiary("slash", "")).toMatchObject({ ok: false });
    expect(validateBeneficiary("slash", "not-an-address")).toMatchObject({
      ok: false,
    });
    expect(
      validateBeneficiary("slash", "0x0000000000000000000000000000000000000000"),
    ).toMatchObject({ ok: false, error: expect.stringContaining("zero address") });
    expect(
      validateBeneficiary("slash", " 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62 "),
    ).toEqual({ ok: true, beneficiary: "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62" });
  });
});
