import { describe, expect, it } from "vitest";
import { partitionByTrust, type RankableSource } from "./trust-rank";

type Source = { id: string };

function src(id: string, score: number | null): RankableSource<Source> {
  return {
    item: { id },
    trust: score === null ? null : { score, tier: "t", confidence: 1 },
  };
}

describe("partitionByTrust", () => {
  it("cites everyone and ranks by score when no threshold is set", () => {
    const { cited, skipped } = partitionByTrust([
      src("low", 10),
      src("high", 90),
      src("none", null),
    ]);

    expect(skipped).toHaveLength(0);
    expect(cited.map((c) => c.item.id)).toEqual(["high", "low", "none"]);
  });

  it("keeps sources at or above the threshold and skips those below", () => {
    const { cited, skipped } = partitionByTrust(
      [src("a", 80), src("b", 40)],
      { minTrust: 50 },
    );

    expect(cited.map((c) => c.item.id)).toEqual(["a"]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].item.id).toBe("b");
    expect(skipped[0].reason).toBe("below trust threshold");
  });

  it("includes null scores by default even when the gate is active", () => {
    const { cited, skipped } = partitionByTrust([src("none", null)], {
      minTrust: 50,
    });

    expect(cited.map((c) => c.item.id)).toEqual(["none"]);
    expect(skipped).toHaveLength(0);
  });

  it("skips null scores only under strictUnscored with an active gate", () => {
    const { cited, skipped } = partitionByTrust([src("none", null)], {
      minTrust: 50,
      strictUnscored: true,
    });

    expect(cited).toHaveLength(0);
    expect(skipped[0].item.id).toBe("none");
    expect(skipped[0].reason).toBe("unscored (strict mode)");
  });
});
