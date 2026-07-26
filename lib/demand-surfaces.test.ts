import { describe, expect, it } from "vitest";
import {
  classifyPayer,
  countAllTimeUnlocksByDesk,
  demandWindowStart,
  isDemandWindow,
  summarizeDemand,
  type DemandPostMeta,
  type DemandUnlockRow,
} from "@/lib/demand-surfaces";

const NOW = new Date("2026-07-26T12:00:00Z");

const AGENT = "0x1111111111111111111111111111111111111111";
const HUMAN = "0x2222222222222222222222222222222222222222";
const agentAddresses = new Set([AGENT.toLowerCase()]);

function row(over: Partial<DemandUnlockRow> = {}): DemandUnlockRow {
  return {
    citation_id: "p1",
    creator_name: "alice",
    creator_wallet: "0xaaa",
    payer: HUMAN,
    gross_usdc: "0.001000",
    royalty_usdc: "0.001000",
    created_at: "2026-07-26T10:00:00Z",
    ...over,
  };
}

const postMeta = new Map<string, DemandPostMeta>([
  ["p1", { id: "p1", title: "Alpha", author: "alice", postKind: "signal", tags: [] }],
  ["p2", { id: "p2", title: "Beta", author: "bob", postKind: "research", tags: [] }],
]);

describe("window helpers", () => {
  it("validates window values", () => {
    expect(isDemandWindow("7d")).toBe(true);
    expect(isDemandWindow("99d")).toBe(false);
    expect(isDemandWindow(null)).toBe(false);
  });

  it("computes the window start from the clock", () => {
    expect(demandWindowStart("1d", NOW).toISOString()).toBe(
      "2026-07-25T12:00:00.000Z",
    );
    expect(demandWindowStart("7d", NOW).toISOString()).toBe(
      "2026-07-19T12:00:00.000Z",
    );
  });
});

describe("classifyPayer", () => {
  it("identifies agent wallets case-insensitively", () => {
    expect(classifyPayer(AGENT.toUpperCase(), agentAddresses)).toBe("agent");
    expect(classifyPayer(AGENT, agentAddresses)).toBe("agent");
  });

  it("treats unknown wallets as human", () => {
    expect(classifyPayer(HUMAN, agentAddresses)).toBe("human");
    expect(classifyPayer(AGENT, new Set())).toBe("human");
  });
});

describe("summarizeDemand", () => {
  it("splits agent and human unlocks", () => {
    const snapshot = summarizeDemand(
      [row({ payer: AGENT }), row({ payer: HUMAN }), row({ payer: AGENT })],
      { window: "7d", now: NOW, agentAddresses, postMeta },
    );
    expect(snapshot.totalUnlocks).toBe(3);
    expect(snapshot.agentUnlocks).toBe(2);
    expect(snapshot.humanUnlocks).toBe(1);
    expect(snapshot.agentSharePct).toBeCloseTo(66.7, 1);
  });

  it("excludes rows older than the window", () => {
    const snapshot = summarizeDemand(
      [row(), row({ created_at: "2026-07-01T00:00:00Z" })],
      { window: "7d", now: NOW, agentAddresses, postMeta },
    );
    expect(snapshot.totalUnlocks).toBe(1);
  });

  it("respects a narrower window", () => {
    const snapshot = summarizeDemand(
      [row(), row({ created_at: "2026-07-22T00:00:00Z" })],
      { window: "1d", now: NOW, agentAddresses, postMeta },
    );
    expect(snapshot.totalUnlocks).toBe(1);
  });

  it("filters out seed desks via isRealDesk", () => {
    const snapshot = summarizeDemand(
      [row({ creator_name: "citation team" }), row({ creator_name: "alice" })],
      {
        window: "7d",
        now: NOW,
        agentAddresses,
        postMeta,
        isRealDesk: (name) => name.toLowerCase() !== "citation team",
      },
    );
    expect(snapshot.totalUnlocks).toBe(1);
    expect(snapshot.topDesks.map((d) => d.username)).toEqual(["alice"]);
  });

  it("ranks top desks by unlocks then earnings", () => {
    const snapshot = summarizeDemand(
      [
        row({ creator_name: "alice" }),
        row({ creator_name: "alice" }),
        row({ creator_name: "bob", royalty_usdc: "5.000000" }),
      ],
      { window: "7d", now: NOW, agentAddresses, postMeta },
    );
    expect(snapshot.topDesks[0].username).toBe("alice");
    expect(snapshot.topDesks[0].unlocks).toBe(2);
  });

  it("sums earnings per desk and overall", () => {
    const snapshot = summarizeDemand(
      [
        row({ creator_name: "alice", royalty_usdc: "0.250000" }),
        row({ creator_name: "alice", royalty_usdc: "0.250000" }),
      ],
      { window: "7d", now: NOW, agentAddresses, postMeta },
    );
    expect(snapshot.earnedUsdc).toBe("0.500000");
    expect(snapshot.topDesks[0].earnedUsdc).toBe("0.500000");
  });

  it("ranks rising desks by period-over-period growth, not raw volume", () => {
    // alice sells more but is flat; bob tripled off a small base.
    const snapshot = summarizeDemand(
      [
        ...Array.from({ length: 10 }, () => row({ creator_name: "alice" })),
        ...Array.from({ length: 3 }, () =>
          row({ creator_name: "bob", citation_id: "p2" }),
        ),
      ],
      {
        window: "7d",
        now: NOW,
        agentAddresses,
        postMeta,
        priorUnlocksByDesk: new Map([
          ["alice", 10],
          ["bob", 0],
        ]),
      },
    );
    expect(snapshot.topDesks[0].username).toBe("alice");
    expect(snapshot.risingDesks[0].username).toBe("bob");
  });

  it("excludes flat and declining desks from the rising lane", () => {
    const snapshot = summarizeDemand(
      [row({ creator_name: "alice" }), row({ creator_name: "alice" })],
      {
        window: "7d",
        now: NOW,
        agentAddresses,
        postMeta,
        priorUnlocksByDesk: new Map([["alice", 5]]),
      },
    );
    expect(snapshot.risingDesks).toEqual([]);
  });

  it("reports the prior-period baseline alongside the window count", () => {
    const snapshot = summarizeDemand([row({ creator_name: "alice" })], {
      window: "7d",
      now: NOW,
      agentAddresses,
      postMeta,
      priorUnlocksByDesk: new Map([["alice", 0]]),
    });
    expect(snapshot.risingDesks[0]).toMatchObject({
      windowUnlocks: 1,
      priorUnlocks: 0,
      growth: 1,
    });
  });

  // Regression: with no prior-period data every desk scored identically and the
  // rising lane just mirrored the top-desk leaderboard.
  it("does not simply mirror top desks when prior data is absent", () => {
    const snapshot = summarizeDemand(
      [
        ...Array.from({ length: 5 }, () => row({ creator_name: "alice" })),
        row({ creator_name: "bob", citation_id: "p2" }),
      ],
      {
        window: "7d",
        now: NOW,
        agentAddresses,
        postMeta,
        priorUnlocksByDesk: new Map([["alice", 5]]),
      },
    );
    expect(snapshot.topDesks[0].username).toBe("alice");
    expect(snapshot.risingDesks.map((d) => d.username)).not.toContain("alice");
  });

  it("separates top signals from top research", () => {
    const snapshot = summarizeDemand(
      [row({ citation_id: "p1" }), row({ citation_id: "p2", creator_name: "bob" })],
      { window: "7d", now: NOW, agentAddresses, postMeta },
    );
    expect(snapshot.topSignals.map((p) => p.postId)).toEqual(["p1"]);
    expect(snapshot.topResearch.map((p) => p.postId)).toEqual(["p2"]);
  });

  it("orders recent unlocks newest first and caps them", () => {
    const snapshot = summarizeDemand(
      [
        row({ created_at: "2026-07-24T00:00:00Z" }),
        row({ created_at: "2026-07-26T00:00:00Z" }),
        row({ created_at: "2026-07-25T00:00:00Z" }),
      ],
      { window: "7d", now: NOW, agentAddresses, postMeta, recentLimit: 2 },
    );
    expect(snapshot.recentUnlocks).toHaveLength(2);
    expect(snapshot.recentUnlocks[0].at).toBe("2026-07-26T00:00:00Z");
  });

  it("returns a zeroed snapshot with no rows", () => {
    const snapshot = summarizeDemand([], { window: "7d", now: NOW });
    expect(snapshot.totalUnlocks).toBe(0);
    expect(snapshot.agentSharePct).toBe(0);
    expect(snapshot.earnedUsdc).toBe("0.000000");
    expect(snapshot.topDesks).toEqual([]);
  });

  it("falls back to the citation id when catalog meta is missing", () => {
    const snapshot = summarizeDemand([row({ citation_id: "ghost" })], {
      window: "7d",
      now: NOW,
      agentAddresses,
      postMeta,
    });
    expect(snapshot.recentUnlocks[0].title).toBe("ghost");
  });

  it("ignores rows with an unparseable timestamp", () => {
    const snapshot = summarizeDemand([row({ created_at: "not-a-date" })], {
      window: "7d",
      now: NOW,
      agentAddresses,
      postMeta,
    });
    expect(snapshot.totalUnlocks).toBe(0);
  });
});

describe("countAllTimeUnlocksByDesk", () => {
  it("counts case-insensitively per desk", () => {
    const counts = countAllTimeUnlocksByDesk([
      { creator_name: "Alice" },
      { creator_name: "alice" },
      { creator_name: "bob" },
    ]);
    expect(counts.get("alice")).toBe(2);
    expect(counts.get("bob")).toBe(1);
  });
});
