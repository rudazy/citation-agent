import { describe, expect, it } from "vitest";
import {
  detectConvictionChanges,
  type ConvictionSignal,
} from "@/lib/conviction-changes";

const NOW = new Date("2026-07-26T12:00:00Z");

function signal(over: Partial<ConvictionSignal> = {}): ConvictionSignal {
  return {
    id: "s1",
    author: "alice",
    tags: ["solana"],
    postKind: "signal",
    signalDirection: "long",
    signalConfidence: 4,
    publishedAt: "2026-07-20T00:00:00Z",
    ...over,
  };
}

describe("detectConvictionChanges", () => {
  it("detects a direction flip on the same theme", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "s1", signalDirection: "long", publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "s2", signalDirection: "short", publishedAt: "2026-07-24T00:00:00Z" }),
      ],
      { now: NOW },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      username: "alice",
      theme: "solana",
      fromDirection: "long",
      toDirection: "short",
      fromPostId: "s1",
      toPostId: "s2",
    });
  });

  it("ignores repeated signals with the same direction", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "s1", publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "s2", publishedAt: "2026-07-24T00:00:00Z" }),
      ],
      { now: NOW },
    );
    expect(changes).toEqual([]);
  });

  it("does not flag a single signal", () => {
    expect(detectConvictionChanges([signal()], { now: NOW })).toEqual([]);
  });

  it("keeps desks and themes separate", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "a1", author: "alice", signalDirection: "long", publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "b1", author: "bob", signalDirection: "short", publishedAt: "2026-07-24T00:00:00Z" }),
      ],
      { now: NOW },
    );
    // Different desks: neither has two signals of its own on this theme.
    expect(changes).toEqual([]);
  });

  it("reports only the latest flip per desk and theme", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "s1", signalDirection: "long", publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "s2", signalDirection: "short", publishedAt: "2026-07-15T00:00:00Z" }),
        signal({ id: "s3", signalDirection: "long", publishedAt: "2026-07-24T00:00:00Z" }),
      ],
      { now: NOW },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      fromDirection: "short",
      toDirection: "long",
      toPostId: "s3",
    });
  });

  it("excludes flips older than the window", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "s1", signalDirection: "long", publishedAt: "2026-01-01T00:00:00Z" }),
        signal({ id: "s2", signalDirection: "short", publishedAt: "2026-02-01T00:00:00Z" }),
      ],
      { now: NOW, windowDays: 30 },
    );
    expect(changes).toEqual([]);
  });

  it("skips research posts and signals without a direction", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "r1", postKind: "research", signalDirection: null, publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "s2", signalDirection: "short", publishedAt: "2026-07-24T00:00:00Z" }),
      ],
      { now: NOW },
    );
    expect(changes).toEqual([]);
  });

  it("matches themes case-insensitively", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "s1", tags: ["Solana"], signalDirection: "long", publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "s2", tags: ["solana"], signalDirection: "avoid", publishedAt: "2026-07-24T00:00:00Z" }),
      ],
      { now: NOW },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].theme).toBe("solana");
  });

  it("attaches titles when supplied", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "s1", signalDirection: "long", publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "s2", signalDirection: "short", publishedAt: "2026-07-24T00:00:00Z" }),
      ],
      { now: NOW, titles: new Map([["s2", "Cutting Solana exposure"]]) },
    );
    expect(changes[0].toTitle).toBe("Cutting Solana exposure");
  });

  it("sorts newest first and honours the limit", () => {
    const changes = detectConvictionChanges(
      [
        signal({ id: "a1", tags: ["eth"], signalDirection: "long", publishedAt: "2026-07-10T00:00:00Z" }),
        signal({ id: "a2", tags: ["eth"], signalDirection: "short", publishedAt: "2026-07-20T00:00:00Z" }),
        signal({ id: "b1", tags: ["btc"], signalDirection: "long", publishedAt: "2026-07-11T00:00:00Z" }),
        signal({ id: "b2", tags: ["btc"], signalDirection: "short", publishedAt: "2026-07-25T00:00:00Z" }),
      ],
      { now: NOW },
    );
    expect(changes[0].theme).toBe("btc");
    expect(
      detectConvictionChanges(
        [
          signal({ id: "a1", tags: ["eth"], signalDirection: "long", publishedAt: "2026-07-10T00:00:00Z" }),
          signal({ id: "a2", tags: ["eth"], signalDirection: "short", publishedAt: "2026-07-20T00:00:00Z" }),
          signal({ id: "b1", tags: ["btc"], signalDirection: "long", publishedAt: "2026-07-11T00:00:00Z" }),
          signal({ id: "b2", tags: ["btc"], signalDirection: "short", publishedAt: "2026-07-25T00:00:00Z" }),
        ],
        { now: NOW, limit: 1 },
      ),
    ).toHaveLength(1);
  });
});
