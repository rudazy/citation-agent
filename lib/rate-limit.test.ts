import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits, clientIpFromRequest } from "./rate-limit";

const OPTS = { namespace: "test", limit: 3, windowMs: 60_000 };

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < OPTS.limit; i++) {
      expect(checkRateLimit("wallet-a", OPTS).allowed).toBe(true);
    }
  });

  it("blocks requests over the limit with a retry-after", () => {
    for (let i = 0; i < OPTS.limit; i++) checkRateLimit("wallet-a", OPTS);
    const over = checkRateLimit("wallet-a", OPTS);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks identifiers independently", () => {
    for (let i = 0; i < OPTS.limit; i++) checkRateLimit("wallet-a", OPTS);
    expect(checkRateLimit("wallet-a", OPTS).allowed).toBe(false);
    // A different wallet is unaffected.
    expect(checkRateLimit("wallet-b", OPTS).allowed).toBe(true);
  });

  it("namespaces are isolated for the same identifier", () => {
    for (let i = 0; i < OPTS.limit; i++) checkRateLimit("wallet-a", OPTS);
    expect(checkRateLimit("wallet-a", OPTS).allowed).toBe(false);
    expect(
      checkRateLimit("wallet-a", { ...OPTS, namespace: "other" }).allowed,
    ).toBe(true);
  });

  it("resets after the window elapses", () => {
    const start = 1_000_000;
    for (let i = 0; i < OPTS.limit; i++) checkRateLimit("wallet-a", OPTS, start);
    expect(checkRateLimit("wallet-a", OPTS, start).allowed).toBe(false);
    // Past the window boundary the counter resets.
    const after = start + OPTS.windowMs + 1;
    expect(checkRateLimit("wallet-a", OPTS, after).allowed).toBe(true);
  });

  it("derives a client IP from proxy headers", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIpFromRequest(req)).toBe("203.0.113.7");
    expect(clientIpFromRequest(new Request("https://example.com"))).toBe("unknown");
  });
});
