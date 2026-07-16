import { http, type HttpTransport } from "viem";

/**
 * The Arc testnet public RPC rate-limits aggressively ("request limit
 * reached") and viem's default transport retries only 3 times with ~150ms
 * delays — far too fast to outlive a limit window. Every Arc client should
 * use this patient transport: exponential backoff spanning ~25s worst case.
 */
export function arcHttpTransport(rpcUrl: string): HttpTransport {
  return http(rpcUrl, {
    retryCount: 5,
    retryDelay: 800,
    timeout: 20_000,
  });
}

/** True when an RPC error is the public endpoint's rate limit, not our bug. */
export function isRpcRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /request limit|rate limit|too many requests|429|limit reached|over rate/i.test(
    message,
  );
}
