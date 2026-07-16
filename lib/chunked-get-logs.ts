/**
 * Rate-limited eth_getLogs + shared RPC retry helpers for Arc public RPC.
 * Sequential chunks only — never fan out parallel getLogs against the same host.
 */

import type { AbiEvent, Log, PublicClient } from "viem";

export type ChunkedGetLogsResult = {
  logs: Log[];
  /** False when a chunk failed after retries or the scan stopped early. */
  complete: boolean;
  /** Last block that was fully scanned without error (inclusive). */
  lastScannedBlock: bigint | null;
  errorMessage?: string;
};

export type RateLimitedCallResult<T> = {
  ok: boolean;
  value?: T;
  errorMessage?: string;
};

const DEFAULT_CHUNK = 800;
const DEFAULT_CHUNK_DELAY_MS = 120;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_START_MS = 500;

export function claimsLogsChunkSize(): bigint {
  const raw = process.env.CLAIMS_LOGS_CHUNK_SIZE?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = BigInt(raw);
    if (n > BigInt(0) && n <= BigInt(9_998)) return n;
  }
  return BigInt(DEFAULT_CHUNK);
}

export function claimsLogsChunkDelayMs(): number {
  const raw = process.env.CLAIMS_LOGS_CHUNK_DELAY_MS?.trim();
  if (raw && /^\d+$/.test(raw)) return Math.min(5_000, Math.max(0, Number(raw)));
  return DEFAULT_CHUNK_DELAY_MS;
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("request limit") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429") ||
    lower.includes("call rate limit") ||
    lower.includes("exceeded the quota")
  );
}

export function publicRpcErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Run an async RPC call with retries and exponential backoff.
 * On rate-limit errors, wait longer before the next attempt.
 */
export async function withRpcRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { maxRetries?: number; backoffStartMs?: number },
): Promise<RateLimitedCallResult<T>> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffStart = options?.backoffStartMs ?? DEFAULT_BACKOFF_START_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (err) {
      lastError = err;
      const rateLimited = isRateLimitError(err);
      console.warn(
        `[rpc] ${label} failed (attempt ${attempt + 1}/${maxRetries + 1})` +
          (rateLimited ? " rate-limit" : ""),
        publicRpcErrorMessage(err),
      );
      if (attempt >= maxRetries) break;
      const delay = backoffStart * 2 ** attempt * (rateLimited ? 2 : 1);
      await sleep(delay);
    }
  }

  return {
    ok: false,
    errorMessage: publicRpcErrorMessage(lastError),
  };
}

/**
 * Split [fromBlock, toBlock] into sequential eth_getLogs chunks.
 * On rate limit, halves the active chunk size for subsequent attempts/chunks.
 * Never throws for RPC failures — returns partial logs + complete=false.
 */
export async function chunkedGetLogs(
  client: PublicClient,
  params: {
    address: `0x${string}`;
    event: AbiEvent;
    fromBlock: bigint;
    toBlock: bigint;
    chunkSize?: bigint;
    chunkDelayMs?: number;
  },
): Promise<ChunkedGetLogsResult> {
  const { address, event, fromBlock, toBlock } = params;
  if (toBlock < fromBlock) {
    return { logs: [], complete: true, lastScannedBlock: toBlock };
  }

  let chunkSize = params.chunkSize ?? claimsLogsChunkSize();
  if (chunkSize < BigInt(1)) chunkSize = BigInt(1);
  const delayMs = params.chunkDelayMs ?? claimsLogsChunkDelayMs();

  const logs: Log[] = [];
  let lastScannedBlock: bigint | null = fromBlock > BigInt(0) ? fromBlock - BigInt(1) : null;
  let from = fromBlock;

  while (from <= toBlock) {
    let to = from + chunkSize - BigInt(1);
    if (to > toBlock) to = toBlock;

    let attemptFrom = from;
    let attemptTo = to;
    let attemptChunk = chunkSize;
    let chunkOk = false;
    let lastErr: string | undefined;

    for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
      try {
        const chunk = await client.getLogs({
          address,
          event,
          fromBlock: attemptFrom,
          toBlock: attemptTo,
        });
        logs.push(...chunk);
        lastScannedBlock = attemptTo;
        chunkOk = true;
        // Promote halved size for the rest of the scan if we recovered via smaller chunks.
        chunkSize = attemptChunk;
        break;
      } catch (err) {
        lastErr = publicRpcErrorMessage(err);
        const rateLimited = isRateLimitError(err);
        console.warn(
          `[chunked-get-logs] ${address} ${attemptFrom}-${attemptTo} attempt ${attempt + 1}`,
          lastErr,
        );
        if (attempt >= DEFAULT_MAX_RETRIES) break;

        if (rateLimited && attemptChunk > BigInt(1)) {
          attemptChunk =
            attemptChunk / BigInt(2) > BigInt(0) ? attemptChunk / BigInt(2) : BigInt(1);
          attemptTo = attemptFrom + attemptChunk - BigInt(1);
          if (attemptTo > toBlock) attemptTo = toBlock;
        }

        const backoff =
          DEFAULT_BACKOFF_START_MS * 2 ** attempt * (rateLimited ? 2 : 1);
        await sleep(backoff);
      }
    }

    if (!chunkOk) {
      return {
        logs,
        complete: false,
        lastScannedBlock,
        errorMessage: lastErr ?? "eth_getLogs chunk failed",
      };
    }

    from = (lastScannedBlock ?? from) + BigInt(1);
    if (from <= toBlock && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    logs,
    complete: true,
    lastScannedBlock: toBlock,
  };
}
