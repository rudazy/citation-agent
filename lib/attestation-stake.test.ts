import { describe, expect, it } from "vitest";
import {
  MAX_FREEZE_DURATION_SECONDS,
  activeStakeTotalUsdc,
  formatDuration,
  isTerminal,
  ownStakes,
  partitionWalletStakes,
  stakeAction,
  statusLabel,
  type StakeRecord,
  type StakeStatusCode,
} from "./attestation-stake";

const NOW = 1_800_000_000;
const WALLET = "0x0F293D22Dee9fccFc13ce095a2C1D4293a670449" as const;

function stake(over: Partial<StakeRecord> = {}): StakeRecord {
  return {
    index: 0,
    staker: WALLET,
    target: "citation:post-1",
    claim: "Reliable source",
    amountUsdc: "1",
    timestamp: NOW - 86_400,
    unlockAt: NOW + 86_400,
    frozenAt: 0,
    firstFrozenAt: 0,
    status: 0,
    ...over,
  };
}

describe("stakeAction — unfrozen stakes", () => {
  it("blocks withdrawal while the lock is running, with a countdown", () => {
    const action = stakeAction(stake({ unlockAt: NOW + 3 * 86_400 }), NOW);
    expect(action.kind).toBe("none");
    expect(action).toMatchObject({ reason: "Locked for 3d" });
  });

  it("allows withdrawal the moment the lock elapses", () => {
    expect(stakeAction(stake({ unlockAt: NOW }), NOW).kind).toBe("withdraw");
    expect(stakeAction(stake({ unlockAt: NOW - 1 }), NOW).kind).toBe("withdraw");
    expect(stakeAction(stake({ unlockAt: NOW + 1 }), NOW).kind).toBe("none");
  });
});

describe("stakeAction — frozen stakes", () => {
  it("reads as under dispute inside the freeze window, not as a countdown to withdraw", () => {
    const action = stakeAction(
      stake({ unlockAt: NOW - 1, frozenAt: NOW - 86_400, firstFrozenAt: NOW - 86_400 }),
      NOW,
    );
    expect(action.kind).toBe("none");
    expect(action).toMatchObject({ reason: expect.stringContaining("Under dispute") });
    expect(action).toMatchObject({ reason: expect.stringContaining("29d") });
  });

  it("offers reclaim once the freeze has outlived MAX_FREEZE_DURATION", () => {
    const firstFrozenAt = NOW - MAX_FREEZE_DURATION_SECONDS;
    const action = stakeAction(
      stake({ unlockAt: NOW - 1, frozenAt: NOW - 1_000, firstFrozenAt }),
      NOW,
    );
    expect(action.kind).toBe("reclaim");
  });

  /**
   * The bypass the contract closes: re-freezing must not roll the deadline
   * forward, so the view must measure from firstFrozenAt, never frozenAt.
   */
  it("measures the freeze deadline from the first freeze, not a later re-freeze", () => {
    const firstFrozenAt = NOW - MAX_FREEZE_DURATION_SECONDS;
    const action = stakeAction(
      stake({ unlockAt: NOW - 1, frozenAt: NOW - 60, firstFrozenAt }),
      NOW,
    );
    expect(action.kind).toBe("reclaim");
  });

  it("still respects the staker's own lock after the freeze expires", () => {
    const action = stakeAction(
      stake({
        unlockAt: NOW + 86_400,
        frozenAt: NOW - 1_000,
        firstFrozenAt: NOW - MAX_FREEZE_DURATION_SECONDS,
      }),
      NOW,
    );
    expect(action.kind).toBe("none");
    expect(action).toMatchObject({ reason: expect.stringContaining("Freeze expired") });
  });
});

describe("stakeAction — terminal stakes", () => {
  it("offers nothing once a stake has left Active, whatever the timers say", () => {
    for (const status of [1, 2, 3, 4] as StakeStatusCode[]) {
      const action = stakeAction(stake({ status, unlockAt: NOW - 86_400 }), NOW);
      expect(action.kind).toBe("none");
      expect(action).toMatchObject({ reason: statusLabel(status) });
    }
  });

  it("labels every status the contract can return", () => {
    expect(statusLabel(0)).toBe("Active");
    expect(statusLabel(1)).toBe("Withdrawn");
    expect(statusLabel(2)).toBe("Released");
    expect(statusLabel(3)).toBe("Slashed");
    expect(statusLabel(4)).toBe("Reclaimed");
    expect(isTerminal(0)).toBe(false);
    expect(isTerminal(3)).toBe(true);
  });
});

describe("formatDuration", () => {
  it("rounds down so a countdown never runs ahead of the chain", () => {
    expect(formatDuration(86_400 * 6 + 3_600 * 4)).toBe("6d 4h");
    expect(formatDuration(86_400 * 2)).toBe("2d");
    expect(formatDuration(3_600 * 5 + 60 * 30)).toBe("5h 30m");
    expect(formatDuration(60 * 12)).toBe("12m");
    expect(formatDuration(30)).toBe("under a minute");
    expect(formatDuration(0)).toBe("now");
    expect(formatDuration(-100)).toBe("now");
  });
});

describe("ownStakes", () => {
  const rows = [
    stake({ index: 0, timestamp: NOW - 100 }),
    stake({ index: 1, staker: "0xAAAA000000000000000000000000000000000001", timestamp: NOW }),
    stake({ index: 2, timestamp: NOW - 50 }),
  ];

  it("matches the wallet case-insensitively and sorts newest first", () => {
    const mine = ownStakes(rows, WALLET.toLowerCase());
    expect(mine.map((s) => s.index)).toEqual([2, 0]);
  });

  it("returns nothing when no wallet is connected", () => {
    expect(ownStakes(rows, null)).toEqual([]);
    expect(ownStakes(rows, "")).toEqual([]);
    expect(ownStakes(rows, "   ")).toEqual([]);
  });
});

describe("partitionWalletStakes", () => {
  it("keeps on-chain v2 rows and hides the matching index history", () => {
    const liveRow = stake({ target: "author:anonymous", amountUsdc: "2" });
    const { live, legacy } = partitionWalletStakes(
      [
        {
          target: "author:anonymous",
          claim: "Quality researcher",
          amountUsdc: "2",
          timestamp: NOW,
          staker: WALLET,
          txHash: "0xba34029f697545d74d63b2906c73c79a26d7b089e0ab5ef5c71c5f599517c567",
        },
      ],
      [liveRow],
    );
    expect(live).toEqual([liveRow]);
    expect(legacy).toEqual([]);
  });

  it("treats index-only targets as legacy (v1, no exit path)", () => {
    const hint = {
      target: "author:ludarep",
      claim: "Developer",
      amountUsdc: "5",
      timestamp: NOW - 10,
      staker: WALLET,
      txHash: "0xbac955fe6b457b05cc998aac23f9f4c8707521b31da751165b4991b415114335" as const,
    };
    const { live, legacy } = partitionWalletStakes([hint], []);
    expect(live).toEqual([]);
    expect(legacy).toHaveLength(1);
    expect(legacy[0].target).toBe("author:ludarep");
  });

  it("collapses duplicate index rows of the same tx on a legacy target", () => {
    const tx =
      "0xba34029f697545d74d63b2906c73c79a26d7b089e0ab5ef5c71c5f599517c567" as const;
    const hint = {
      target: "author:anonymous",
      claim: "Quality researcher",
      amountUsdc: "2",
      timestamp: NOW,
      staker: WALLET,
      txHash: tx,
    };
    const { legacy } = partitionWalletStakes([hint, { ...hint }], []);
    expect(legacy).toHaveLength(1);
  });
});

describe("activeStakeTotalUsdc", () => {
  it("counts only stakes that are still recoverable", () => {
    const rows = [
      stake({ amountUsdc: "1.5" }),
      stake({ amountUsdc: "0.25" }),
      stake({ amountUsdc: "10", status: 1 }),
      stake({ amountUsdc: "5", status: 3 }),
    ];
    expect(activeStakeTotalUsdc(rows)).toBe("1.75");
  });

  it("reports 0 when everything has exited", () => {
    expect(activeStakeTotalUsdc([stake({ amountUsdc: "2", status: 1 })])).toBe("0");
    expect(activeStakeTotalUsdc([])).toBe("0");
  });
});
