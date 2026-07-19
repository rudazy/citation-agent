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

/**
 * Circle's public Arc RPC rate-limits aggressively under marketplace load.
 * Clients that only accept a single URL (e.g. Circle GatewayClient) should
 * try alternate public endpoints first when no private RPC is configured.
 */
export const CIRCLE_PUBLIC_ARC_RPC = "https://rpc.testnet.arc.network";

/**
 * Ordered RPC list optimized for single-endpoint clients.
 * If the primary is still the free Circle endpoint, deprioritize it so
 * Blockdaemon/dRPC/QuickNode absorb deposit balanceOf + approve traffic.
 * Explicit private/paid ARC_TESTNET_RPC stays first.
 */
export function resolveGatewayRpcUrls(primary?: string | null): string[] {
  const urls = resolveArcRpcUrls(primary);
  if (urls.length <= 1) return urls;

  const explicitPrimary =
    primary?.trim() ||
    process.env.ARC_TESTNET_RPC?.trim() ||
    process.env.NEXT_PUBLIC_ARC_TESTNET_RPC?.trim();

  // Keep a configured non-Circle primary first.
  if (explicitPrimary && explicitPrimary !== CIRCLE_PUBLIC_ARC_RPC) {
    return urls;
  }

  const preferred = urls.filter((u) => u !== CIRCLE_PUBLIC_ARC_RPC);
  const circle = urls.filter((u) => u === CIRCLE_PUBLIC_ARC_RPC);
  return [...preferred, ...circle];
}

/** First RPC for single-URL clients (GatewayClient, etc.). */
export function getPreferredArcRpcUrl(primary?: string | null): string {
  return resolveGatewayRpcUrls(primary)[0] ?? CIRCLE_PUBLIC_ARC_RPC;
}

/** True when an RPC error is the public endpoint's rate limit, not our bug. */
export function isRpcRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /request limit|rate limit|too many requests|429|limit reached|over rate/i.test(
    message,
  );
}

/** User-facing copy when Arc public RPCs are exhausted. */
export const ARC_RPC_RATE_LIMIT_MESSAGE =
  "Arc testnet RPC is rate-limited right now. Wait a few seconds and retry — nothing was deposited.";
