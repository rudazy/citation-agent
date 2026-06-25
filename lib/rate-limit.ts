/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * Best-effort abuse throttle for write-heavy endpoints. It deliberately avoids
 * external infra (Redis etc.): a single process keeps counters in a Map and
 * prunes expired windows lazily. In a multi-instance deployment each instance
 * enforces its own window, which is acceptable for the goal here (stopping a
 * single wallet/session from spamming an endpoint), not precise global quotas.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  /** Requests still permitted in the current window. */
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Max requests permitted per identifier within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Distinguishes limiters that share an identifier (e.g. "upload" vs "publish"). */
  namespace: string;
};

/**
 * Record a request for `identifier` and report whether it is within the limit.
 * Call once per request; the call itself counts against the limit.
 */
export function checkRateLimit(
  identifier: string,
  { limit, windowMs, namespace }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const key = `${namespace}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Test-only: clear all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client identifier from common proxy headers, used only as a
 * fallback when no stronger identity (e.g. a proven wallet) is available.
 */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
