import { fallback, http, type Transport } from "viem";

/**
 * Public Arc testnet RPCs that work without API keys.
 * Primary Circle endpoint rate-limits aggressively under dashboard load
 * (claims scan + balance reads + stake write share one per-IP quota).
 * Fallbacks let stake/write paths continue when the primary is 429'd.
 *
 * Verified reachable 2026-07-17 (blockNumber). Prefer paid/private
 * ARC_TESTNET_RPC in production when available.
 */
export const ARC_PUBLIC_RPC_FALLBACKS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://arc-testnet.drpc.org",
  "https://rpc.quicknode.testnet.arc.network",
  "https://5042002.rpc.thirdweb.com",
] as const;

function splitCsv(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Ordered RPC list: explicit primary, then env extras, then public fallbacks.
 * Dedupes while preserving order so the configured endpoint stays first.
 */
export function resolveArcRpcUrls(primary?: string | null): string[] {
  const primaryUrl =
    primary?.trim() ||
    process.env.ARC_TESTNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_ARC_TESTNET_RPC?.trim() ||
    ARC_PUBLIC_RPC_FALLBACKS[0];

  const extras = [
    ...splitCsv(process.env.ARC_TESTNET_RPC_FALLBACKS),
    ...splitCsv(process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_FALLBACKS),
    ...ARC_PUBLIC_RPC_FALLBACKS,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [primaryUrl, ...extras]) {
    const u = url.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * Patient multi-endpoint transport for Arc testnet.
 * Each URL retries a few times with backoff; on rate-limit/network failure
 * viem falls through to the next provider so stake writes still land.
 */
export function arcHttpTransport(rpcUrl?: string | null): Transport {
  const urls = resolveArcRpcUrls(rpcUrl);
  return fallback(
    urls.map((url) =>
      http(url, {
        // Modest per-URL retries — fallback handles provider switching.
        retryCount: 2,
        retryDelay: 700,
        timeout: 20_000,
      }),
    ),
    {
      rank: false,
      retryCount: 1,
    },
  );
}

/** True when an RPC error is the public endpoint's rate limit, not our bug. */
export function isRpcRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /request limit|rate limit|too many requests|429|limit reached|over rate/i.test(
    message,
  );
}
