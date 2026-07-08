import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trustgate-paid-store", () => ({
  getCachedPaidScore: vi.fn(async () => ({ hit: false, value: null })),
}));

vi.mock("@/lib/trustgate-wallet-rescore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./trustgate-wallet-rescore")>();
  return {
    ...actual,
    rescoreWallet: vi.fn(async (rawScore: number) => ({
      score: rawScore,
      tier: "HIGH",
      recommendation: "INSTANT",
      confidence: "MEDIUM",
      limitations: [],
    })),
  };
});

import { clearTrustCache, getTrustScore, getTrustScores } from "./trustgate";

const URL_ENV = "TRUSTGATE_SCORE_API_URL";

function mockJsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe("trustgate", () => {
  beforeEach(() => {
    clearTrustCache();
    process.env[URL_ENV] = "https://scores.example.test/score/{address}";
    process.env.SCORING_WALLET_NON_ELITE_CAP = "79";
    delete process.env.TRUSTGATE_CACHE_TTL_MS;
    delete process.env.TRUSTGATE_NULL_CACHE_TTL_MS;
    delete process.env.TRUSTGATE_TIMEOUT_MS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env[URL_ENV];
    delete process.env.SCORING_WALLET_NON_ELITE_CAP;
  });

  it("returns a parsed score and serves the cache on a second call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        mockJsonResponse({ score: 72, tier: "high", confidence: 0.9 }),
      );

    const first = await getTrustScore("0xABC");
    expect(first).toEqual({ score: 72, tier: "HIGH", confidence: 0 });

    // Cache hit: no second network call, same value.
    const second = await getTrustScore("0xabc");
    expect(second).toEqual({ score: 72, tier: "HIGH", confidence: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after the cache entry expires (cache miss)", async () => {
    process.env.TRUSTGATE_CACHE_TTL_MS = "1000";
    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ score: 10, tier: "low", confidence: 0.1 }));

    await getTrustScore("0xdef");
    vi.advanceTimersByTime(1500);
    await getTrustScore("0xdef");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null on timeout (aborted fetch)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });

    process.env.TRUSTGATE_TIMEOUT_MS = "10";
    const result = await getTrustScore("0x1");
    expect(result).toBeNull();
  });

  it("returns null on a non 2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse({ error: "nope" }, false),
    );
    expect(await getTrustScore("0x2")).toBeNull();
  });

  it("returns null when the body has no numeric score", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse({ tier: "high" }),
    );
    expect(await getTrustScore("0x3")).toBeNull();
  });

  it("dedupes addresses in a batch so each wallet is fetched once", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ score: 50, tier: "mid", confidence: 0.5 }));

    const scores = await getTrustScores(["0xAAA", "0xaaa", "0xBBB"]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(scores.get("0xaaa")).toEqual({ score: 50, tier: "HIGH", confidence: 0 });
    expect(scores.get("0xbbb")).toEqual({ score: 50, tier: "HIGH", confidence: 0 });
  });

  it("returns null without fetching when the endpoint is unset", async () => {
    delete process.env[URL_ENV];
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await getTrustScore("0x9")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns raw arc-score without rescore when SCORING_WALLET_* is unset", async () => {
    delete process.env.SCORING_WALLET_NON_ELITE_CAP;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJsonResponse({ score: 88, tier: "HIGH", confidence: 0.5 }),
    );

    const score = await getTrustScore("0xabc");
    expect(score).toEqual({ score: 88, tier: "HIGH", confidence: 0.5 });
  });

  it("re-fetches null cache entries sooner than successful scores", async () => {
    process.env.TRUSTGATE_CACHE_TTL_MS = "60000";
    process.env.TRUSTGATE_NULL_CACHE_TTL_MS = "500";
    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ error: "nope" }, false));

    await getTrustScore("0xnull");
    vi.advanceTimersByTime(600);
    await getTrustScore("0xnull");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
