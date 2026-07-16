import {
  createPublicClient,
  decodeFunctionData,
  formatUnits,
  http,
  type AbiEvent,
  type Log,
  type PublicClient,
} from "viem";
import { arcTestnet } from "viem/chains";
import { ATTESTATION_ABI, getAttestationAddress } from "@/lib/attestation";
import {
  canonicalizeAttestationTarget,
  classifyTarget,
  formatTargetLabel,
} from "@/lib/attestation-client";
import {
  chunkedGetLogs,
  claimsLogsChunkDelayMs,
  claimsLogsMaxChunksPerRequest,
  claimsLogsScanBudgetMs,
  sleep,
  withRpcRetry,
} from "@/lib/chunked-get-logs";
import {
  getBlockTimestamps,
  getLogCursor,
  loadAttestationEvents,
  setLogCursor,
  upsertAttestationEvents,
  upsertBlockTimestamps,
  type StoredAttestationEvent,
} from "@/lib/log-cursors";
import { getTrustScores, type TrustScore } from "@/lib/trustgate";

export type IndexedAttestation = {
  target: string;
  canonicalTarget: string;
  claim: string;
  amountUsdc: string;
  amountUnits: bigint;
  staker: `0x${string}`;
  timestamp: number;
  txHash: `0x${string}` | null;
};

export type TargetSummary = {
  target: string;
  label: string;
  kind: ReturnType<typeof classifyTarget>;
  totalUsdc: string;
  claimCount: number;
  /** Distinct wallets that staked on this target. */
  backerCount: number;
  /** Display-only stake scaled by each staker's normalized TrustGate score. */
  trustWeightedUsdc: string;
  /** Stakers with no TrustGate score (counted at raw stake in the aggregate). */
  unscoredStakers: number;
};

/** JSON-safe claim row for API responses (no bigint). */
export type PublicClaim = {
  target: string;
  claim: string;
  amountUsdc: string;
  staker: `0x${string}`;
  timestamp: number;
  txHash: `0x${string}` | null;
  trust?: TrustScore | null;
};

/** Result of a claims index load — may be partial when RPC scan is incomplete. */
export type IndexLoadResult = {
  rows: IndexedAttestation[];
  /** False when eth_getLogs or enrichment failed partway; UI should soft-warn. */
  complete: boolean;
  /** True when some rows are available even if complete is false. */
  partial: boolean;
  /** Server-only diagnostic; never show raw RPC text to clients. */
  errorMessage?: string;
};

function toPublicClaim(
  row: IndexedAttestation,
  scores: Map<string, TrustScore | null>,
): PublicClaim {
  return {
    target: row.canonicalTarget,
    claim: row.claim,
    amountUsdc: row.amountUsdc,
    staker: row.staker,
    timestamp: row.timestamp,
    txHash: row.txHash,
    trust: scores.get(row.staker.toLowerCase()) ?? null,
  };
}

/**
 * Display-only trust weighting. Each stake is scaled by the staker's score
 * normalized against the highest scored staker in the same set (a relative,
 * self contained measure that hardcodes no absolute range or weight). Unscored
 * stakers fall back to their raw stake with no weighting.
 */
function computeTrustWeighted(
  rows: IndexedAttestation[],
  scores: Map<string, TrustScore | null>,
): { trustWeightedUsdc: string; unscoredStakers: number } {
  let maxScore = 0;
  for (const row of rows) {
    const trust = scores.get(row.staker.toLowerCase()) ?? null;
    if (trust) maxScore = Math.max(maxScore, trust.score);
  }

  let weighted = 0;
  let unscored = 0;
  for (const row of rows) {
    const trust = scores.get(row.staker.toLowerCase()) ?? null;
    const amount = parseFloat(row.amountUsdc) || 0;
    if (trust && maxScore > 0) {
      weighted += amount * (trust.score / maxScore);
    } else {
      weighted += amount;
      if (!trust) unscored += 1;
    }
  }

  return { trustWeightedUsdc: weighted.toFixed(6), unscoredStakers: unscored };
}

type CacheEntry<T> = { at: number; data: T };

let summaryCache: CacheEntry<TargetSummary[]> | null = null;
let indexCache: CacheEntry<IndexLoadResult> | null = null;
const CACHE_TTL_MS = 5_000;
const DEFAULT_DEPLOY_BLOCK = BigInt(48_054_370);

const ATTESTED_EVENT_ABI: AbiEvent = {
  type: "event",
  name: "Attested",
  inputs: [
    { name: "target", type: "string", indexed: true },
    { name: "staker", type: "address", indexed: true },
    { name: "claim", type: "string", indexed: false },
    { name: "amount", type: "uint256", indexed: false },
    { name: "platformFee", type: "uint256", indexed: false },
  ],
};

/** Deployed attestation contract before platform-fee event field was added. */
const ATTESTED_LEGACY_EVENT_ABI: AbiEvent = {
  type: "event",
  name: "Attested",
  inputs: [
    { name: "target", type: "string", indexed: true },
    { name: "staker", type: "address", indexed: true },
    { name: "claim", type: "string", indexed: false },
    { name: "amount", type: "uint256", indexed: false },
  ],
};

function deployFromBlock(): bigint {
  const raw = process.env.ATTESTATION_DEPLOY_BLOCK;
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return DEFAULT_DEPLOY_BLOCK;
}

function rpcClient(): PublicClient {
  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  return createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
}

export function invalidateAttestationCache(): void {
  summaryCache = null;
  indexCache = null;
}

function logDedupeKey(log: Log): string {
  return `${log.transactionHash ?? "0x"}:${log.logIndex ?? 0}`;
}

function storedToIndexed(row: StoredAttestationEvent): IndexedAttestation {
  const amountUnits = BigInt(row.amountUnits);
  return {
    target: row.target,
    canonicalTarget: canonicalizeAttestationTarget(row.target),
    claim: row.claim,
    amountUnits,
    amountUsdc: formatUnits(amountUnits, 6),
    staker: row.staker,
    timestamp: row.blockTimestamp,
    txHash: row.txHash,
  };
}

/**
 * Current then legacy Attested event scans — sequential, never Promise.all.
 * Budget is split across both ABI sweeps so one request cannot hang for minutes.
 * Merges and dedupes by txHash:logIndex.
 */
async function fetchAttestedLogsIncremental(
  client: PublicClient,
  contractAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<{
  logs: Log[];
  complete: boolean;
  budgetExhausted: boolean;
  lastScannedBlock: bigint | null;
  errorMessage?: string;
}> {
  const maxChunks = claimsLogsMaxChunksPerRequest();
  const totalBudget = claimsLogsScanBudgetMs();
  // Prefer finishing the current event ABI first; give legacy a smaller share.
  const currentBudget = Math.floor(totalBudget * 0.65);
  const legacyBudget = Math.max(2_000, totalBudget - currentBudget);
  const currentChunks = Math.max(4, Math.floor(maxChunks * 0.65));
  const legacyChunks = Math.max(2, maxChunks - currentChunks);

  const current = await chunkedGetLogs(client, {
    address: contractAddress,
    event: ATTESTED_EVENT_ABI,
    fromBlock,
    toBlock,
    maxChunks: currentChunks,
    deadlineMs: currentBudget,
  });

  await sleep(claimsLogsChunkDelayMs());

  // Only re-scan legacy through the high-water mark we actually covered.
  const legacyTo =
    current.lastScannedBlock != null && current.lastScannedBlock >= fromBlock
      ? current.lastScannedBlock
      : fromBlock > BigInt(0)
        ? fromBlock - BigInt(1)
        : BigInt(0);

  const legacy =
    legacyTo >= fromBlock
      ? await chunkedGetLogs(client, {
          address: contractAddress,
          event: ATTESTED_LEGACY_EVENT_ABI,
          fromBlock,
          toBlock: legacyTo,
          maxChunks: legacyChunks,
          deadlineMs: legacyBudget,
        })
      : {
          logs: [] as Log[],
          complete: true,
          budgetExhausted: false,
          lastScannedBlock: legacyTo,
        };

  const seen = new Set<string>();
  const merged: Log[] = [];
  for (const log of [...current.logs, ...legacy.logs]) {
    const key = logDedupeKey(log);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(log);
  }

  // Cursor can only advance to a block both ABI sweeps fully covered.
  const lastScannedBlock =
    current.lastScannedBlock != null && legacy.lastScannedBlock != null
      ? current.lastScannedBlock < legacy.lastScannedBlock
        ? current.lastScannedBlock
        : legacy.lastScannedBlock
      : (current.lastScannedBlock ?? legacy.lastScannedBlock ?? null);

  const reachedHead =
    lastScannedBlock != null && lastScannedBlock >= toBlock && current.complete;
  const budgetExhausted = Boolean(
    current.budgetExhausted || legacy.budgetExhausted,
  );

  return {
    logs: merged,
    complete: reachedHead && legacy.complete && !budgetExhausted,
    budgetExhausted,
    lastScannedBlock,
    errorMessage: current.errorMessage ?? legacy.errorMessage,
  };
}

type EnrichedRow = IndexedAttestation & { logIndex: number; blockNumber: bigint };

/**
 * Enrich raw logs into indexed rows. getTransaction / getBlock run sequentially
 * with retry/backoff; block timestamps are deduped and persisted.
 */
async function enrichLogs(
  client: PublicClient,
  contractAddress: `0x${string}`,
  logs: Log[],
): Promise<{ rows: EnrichedRow[]; complete: boolean; errorMessage?: string }> {
  if (logs.length === 0) return { rows: [], complete: true };

  const blockNumbers = logs
    .map((log) => log.blockNumber)
    .filter((b): b is bigint => b != null);

  const tsCache = await getBlockTimestamps(blockNumbers);
  const memoryTs = new Map<bigint, number>(tsCache);
  const newlyFetchedTs: Array<{ blockNumber: bigint; timestamp: number }> = [];
  const txCache = new Map<
    `0x${string}`,
    { decoded: ReturnType<typeof decodeFunctionData>; from: `0x${string}` }
  >();

  const delayMs = claimsLogsChunkDelayMs();
  const results: EnrichedRow[] = [];
  let complete = true;
  let errorMessage: string | undefined;

  for (const log of logs) {
    const txHash = log.transactionHash;
    if (!txHash) continue;
    const logIndex = Number(log.logIndex ?? 0);
    const blockNumber = log.blockNumber ?? BigInt(0);

    let cached = txCache.get(txHash);
    if (!cached) {
      const txResult = await withRpcRetry(`getTransaction ${txHash.slice(0, 10)}`, () =>
        client.getTransaction({ hash: txHash }),
      );
      if (!txResult.ok || !txResult.value) {
        complete = false;
        errorMessage = txResult.errorMessage ?? "getTransaction failed";
        // Keep going with remaining logs — partial index.
        continue;
      }
      try {
        const decoded = decodeFunctionData({
          abi: ATTESTATION_ABI,
          data: txResult.value.input,
        });
        cached = { decoded, from: txResult.value.from };
        txCache.set(txHash, cached);
      } catch {
        continue;
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    if (cached.decoded.functionName !== "attest") continue;
    const [target, claim, amount] = cached.decoded.args as [string, string, bigint];

    let timestamp = 0;
    if (blockNumber > BigInt(0)) {
      const mem = memoryTs.get(blockNumber);
      if (mem !== undefined) {
        timestamp = mem;
      } else {
        const blockResult = await withRpcRetry(`getBlock ${blockNumber}`, () =>
          client.getBlock({ blockNumber }),
        );
        if (blockResult.ok && blockResult.value) {
          timestamp = Number(blockResult.value.timestamp);
          memoryTs.set(blockNumber, timestamp);
          newlyFetchedTs.push({ blockNumber, timestamp });
        } else {
          complete = false;
          errorMessage = blockResult.errorMessage ?? "getBlock failed";
        }
        if (delayMs > 0) await sleep(delayMs);
      }
    }

    results.push({
      target,
      canonicalTarget: canonicalizeAttestationTarget(target),
      claim,
      amountUnits: amount,
      amountUsdc: formatUnits(amount, 6),
      staker: cached.from,
      timestamp,
      txHash,
      logIndex,
      blockNumber,
    });
  }

  if (newlyFetchedTs.length > 0) {
    await upsertBlockTimestamps(newlyFetchedTs);
  }

  const toStore: StoredAttestationEvent[] = results.map((row) => ({
    contractAddress,
    txHash: row.txHash!,
    logIndex: row.logIndex,
    target: row.target,
    claim: row.claim,
    amountUnits: row.amountUnits.toString(),
    staker: row.staker,
    blockNumber: row.blockNumber,
    blockTimestamp: row.timestamp,
  }));
  await upsertAttestationEvents(toStore);

  return { rows: results, complete, errorMessage };
}

async function readOnChainClaims(target: string): Promise<IndexedAttestation[]> {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) return [];

  const client = rpcClient();
  const result = await withRpcRetry(`getAttestations ${target.slice(0, 24)}`, () =>
    client.readContract({
      address: contractAddress,
      abi: ATTESTATION_ABI,
      functionName: "getAttestations",
      args: [target],
    }),
  );

  if (!result.ok || !result.value) return [];

  return result.value.map((row) => ({
    target: row.target,
    canonicalTarget: canonicalizeAttestationTarget(row.target),
    claim: row.claim,
    amountUnits: row.amount,
    amountUsdc: formatUnits(row.amount, 6),
    staker: row.staker,
    timestamp: Number(row.timestamp),
    txHash: null,
  }));
}

/**
 * Load indexed attestations: Supabase event index + incremental getLogs from
 * log_cursors. Never throws for RPC failures; returns partial rows instead.
 */
export async function fetchIndexedAttestationsResult(): Promise<IndexLoadResult> {
  if (indexCache && Date.now() - indexCache.at < CACHE_TTL_MS) {
    return indexCache.data;
  }

  const contractAddress = getAttestationAddress();
  if (!contractAddress) {
    const empty: IndexLoadResult = { rows: [], complete: true, partial: false };
    return empty;
  }

  const client = rpcClient();
  const deploy = deployFromBlock();

  // 1) Hydrate from durable index (cold-start safe).
  const stored = await loadAttestationEvents(contractAddress);
  const byKey = new Map<string, IndexedAttestation>();
  for (const row of stored) {
    const indexed = storedToIndexed(row);
    const key = `${indexed.txHash}:${row.logIndex}`;
    byKey.set(key, indexed);
  }

  // 2) Resolve scan window from cursor (source of truth for scanned range).
  const cursor = await getLogCursor(contractAddress);
  const latestResult = await withRpcRetry("getBlockNumber", () => client.getBlockNumber());
  if (!latestResult.ok || latestResult.value == null) {
    const rows = [...byKey.values()].sort((a, b) => b.timestamp - a.timestamp);
    const result: IndexLoadResult = {
      rows,
      complete: false,
      partial: rows.length > 0,
      errorMessage: latestResult.errorMessage ?? "Failed to read chain head",
    };
    indexCache = { at: Date.now(), data: result };
    return result;
  }

  const latest = latestResult.value;
  const fromBlock =
    cursor != null && cursor >= deploy ? cursor + BigInt(1) : deploy;

  let scanComplete = true;
  let scanError: string | undefined;

  if (fromBlock <= latest) {
    const logScan = await fetchAttestedLogsIncremental(
      client,
      contractAddress,
      fromBlock,
      latest,
    );
    scanComplete = logScan.complete;
    scanError = logScan.budgetExhausted
      ? "Partial results, still syncing"
      : logScan.errorMessage;

    let enrichComplete = true;
    let lastEnrichedBlock: bigint | null = null;

    if (logScan.logs.length > 0) {
      const enriched = await enrichLogs(client, contractAddress, logScan.logs);
      enrichComplete = enriched.complete;
      if (!enriched.complete) {
        scanComplete = false;
        scanError = scanError ?? enriched.errorMessage;
      }
      for (const row of enriched.rows) {
        byKey.set(`${row.txHash}:${row.logIndex}`, row);
        if (
          lastEnrichedBlock == null ||
          row.blockNumber > lastEnrichedBlock
        ) {
          lastEnrichedBlock = row.blockNumber;
        }
      }
    }

    // Advance cursor only through blocks we actually covered.
    // If enrichment failed, do not jump past the last successfully enriched block
    // (otherwise events are permanently skipped).
    let cursorTo: bigint | null = null;
    if (logScan.logs.length === 0 && logScan.lastScannedBlock != null) {
      // Empty range scanned successfully — safe to advance.
      cursorTo = logScan.lastScannedBlock;
    } else if (enrichComplete && logScan.lastScannedBlock != null) {
      cursorTo = logScan.lastScannedBlock;
    } else if (lastEnrichedBlock != null) {
      cursorTo = lastEnrichedBlock;
    }

    if (cursorTo != null && cursorTo >= fromBlock) {
      await setLogCursor(contractAddress, cursorTo);
    }

    if (logScan.budgetExhausted || !logScan.complete) {
      scanComplete = false;
    }
  }

  // Prefer durable index after upsert (cold-start source of truth).
  const refreshed = await loadAttestationEvents(contractAddress);
  if (refreshed.length > 0) {
    byKey.clear();
    for (const row of refreshed) {
      byKey.set(`${row.txHash}:${row.logIndex}`, storedToIndexed(row));
    }
  }

  const rows = [...byKey.values()].sort((a, b) => b.timestamp - a.timestamp);

  const result: IndexLoadResult = {
    rows,
    complete: scanComplete,
    partial: !scanComplete && rows.length > 0,
    errorMessage: scanError,
  };
  indexCache = { at: Date.now(), data: result };
  return result;
}

/** @deprecated Prefer fetchIndexedAttestationsResult for partial-scan awareness. */
export async function fetchIndexedAttestations(): Promise<IndexedAttestation[]> {
  const result = await fetchIndexedAttestationsResult();
  return result.rows;
}

async function supplementFromOnChain(
  rows: IndexedAttestation[],
): Promise<IndexedAttestation[]> {
  if (rows.length > 0) return rows;

  if (!getAttestationAddress()) return rows;

  const supplemented: IndexedAttestation[] = [];
  for (const target of ["x:@trustgated"]) {
    supplemented.push(...(await readOnChainClaims(target)));
  }

  return supplemented.sort((a, b) => b.timestamp - a.timestamp);
}

export type TargetSummariesResult = {
  targets: TargetSummary[];
  complete: boolean;
  partial: boolean;
  errorMessage?: string;
};

export async function getTargetSummariesResult(): Promise<TargetSummariesResult> {
  if (summaryCache && Date.now() - summaryCache.at < CACHE_TTL_MS) {
    const cached = indexCache?.data;
    return {
      targets: summaryCache.data,
      complete: cached?.complete ?? true,
      partial: cached?.partial ?? false,
      errorMessage: cached?.errorMessage,
    };
  }

  const loaded = await fetchIndexedAttestationsResult();
  let rows = loaded.rows;
  if (rows.length === 0) {
    rows = await supplementFromOnChain(rows);
  }

  const byTarget = new Map<string, IndexedAttestation[]>();
  for (const row of rows) {
    const key = row.canonicalTarget;
    const existing = byTarget.get(key);
    if (existing) {
      existing.push(row);
    } else {
      byTarget.set(key, [row]);
    }
  }

  const scores = await getTrustScores(rows.map((row) => row.staker));

  const summaries = [...byTarget.entries()]
    .map(([target, targetRows]) => {
      const total = targetRows.reduce((sum, row) => sum + row.amountUnits, BigInt(0));
      const { trustWeightedUsdc, unscoredStakers } = computeTrustWeighted(
        targetRows,
        scores,
      );
      const backerCount = new Set(
        targetRows.map((row) => row.staker.toLowerCase()),
      ).size;
      return {
        target,
        label: formatTargetLabel(target),
        kind: classifyTarget(target),
        totalUsdc: formatUnits(total, 6),
        claimCount: targetRows.length,
        backerCount,
        trustWeightedUsdc,
        unscoredStakers,
      };
    })
    .sort((a, b) => parseFloat(b.totalUsdc) - parseFloat(a.totalUsdc));

  summaryCache = { at: Date.now(), data: summaries };
  return {
    targets: summaries,
    complete: loaded.complete,
    partial: loaded.partial,
    errorMessage: loaded.errorMessage,
  };
}

export async function getTargetSummaries(): Promise<TargetSummary[]> {
  const result = await getTargetSummariesResult();
  return result.targets;
}

function buildTargetSummary(
  target: string,
  targetRows: IndexedAttestation[],
  scores: Map<string, TrustScore | null>,
): TargetSummary {
  const total = targetRows.reduce((sum, row) => sum + row.amountUnits, BigInt(0));
  const { trustWeightedUsdc, unscoredStakers } = computeTrustWeighted(targetRows, scores);
  const backerCount = new Set(targetRows.map((row) => row.staker.toLowerCase())).size;
  return {
    target,
    label: formatTargetLabel(target),
    kind: classifyTarget(target),
    totalUsdc: formatUnits(total, 6),
    claimCount: targetRows.length,
    backerCount,
    trustWeightedUsdc,
    unscoredStakers,
  };
}

/**
 * Backing stats for catalog targets. Log index can lag; on-chain reads fill gaps.
 *
 * Catalog list loads should pass `skipOnChain: true` so one slow Arc RPC
 * never blocks the research feed. Pass `forceOnChain: true` (refresh) for
 * the full index + chain fill path.
 */
export async function getBackingSummariesForTargets(
  targets: string[],
  options?: { forceOnChain?: boolean; skipOnChain?: boolean },
): Promise<TargetSummary[]> {
  const unique = [
    ...new Set(targets.map((t) => canonicalizeAttestationTarget(t)).filter(Boolean)),
  ];
  if (unique.length === 0) return [];

  const indexed = await getTargetSummaries();
  const byTarget = new Map(indexed.map((row) => [row.target, row]));

  // Fast path for catalog: indexed summaries only (no per-target eth_call).
  if (options?.skipOnChain && !options.forceOnChain) {
    return unique
      .map((target) => byTarget.get(target))
      .filter((row): row is TargetSummary => row != null);
  }

  const contractAddress = getAttestationAddress();
  if (!contractAddress) return [...byTarget.values()];

  const needsOnChain = options?.forceOnChain
    ? unique
    : unique.filter((target) => (byTarget.get(target)?.backerCount ?? 0) < 1);

  if (needsOnChain.length === 0) return [...byTarget.values()];

  const client = rpcClient();
  // Sequential on-chain fills to avoid RPC storms (was Promise.all).
  const onChainRows: Array<{ target: string; rows: IndexedAttestation[] }> = [];
  for (const target of needsOnChain) {
    try {
      const countResult = await withRpcRetry(`attestationCount ${target.slice(0, 24)}`, () =>
        client.readContract({
          address: contractAddress,
          abi: ATTESTATION_ABI,
          functionName: "attestationCount",
          args: [target],
        }),
      );
      if (!countResult.ok || countResult.value === BigInt(0)) {
        onChainRows.push({ target, rows: [] });
        continue;
      }
      const rows = await readOnChainClaims(target);
      onChainRows.push({ target, rows });
      await sleep(claimsLogsChunkDelayMs());
    } catch (err) {
      console.warn(
        "[attestation-index] on-chain backing read failed for",
        target,
        err instanceof Error ? err.message : err,
      );
      onChainRows.push({ target, rows: [] });
    }
  }

  const allStakers = onChainRows.flatMap((entry) => entry.rows.map((row) => row.staker));
  const scores = await getTrustScores(allStakers);

  for (const { target, rows } of onChainRows) {
    if (rows.length === 0) continue;
    byTarget.set(target, buildTargetSummary(target, rows, scores));
  }

  return [...byTarget.values()];
}

export async function getTargetClaims(target: string): Promise<{
  target: string;
  label: string;
  kind: ReturnType<typeof classifyTarget>;
  totalUsdc: string;
  trustWeightedUsdc: string;
  unscoredStakers: number;
  claims: PublicClaim[];
  complete: boolean;
  partial: boolean;
}> {
  const canonical = canonicalizeAttestationTarget(target);
  const loaded = await fetchIndexedAttestationsResult();
  let claims = loaded.rows.filter((row) => row.canonicalTarget === canonical);

  if (claims.length === 0) {
    for (const candidate of [canonical, target.trim()]) {
      const onChain = await readOnChainClaims(candidate);
      if (onChain.length > 0) {
        claims = onChain.filter((row) => row.canonicalTarget === canonical);
        if (claims.length === 0) claims = onChain;
        break;
      }
    }
  }

  const totalUnits = claims.reduce((sum, row) => sum + row.amountUnits, BigInt(0));
  const scores = await getTrustScores(claims.map((row) => row.staker));
  const { trustWeightedUsdc, unscoredStakers } = computeTrustWeighted(claims, scores);

  return {
    target: canonical,
    label: formatTargetLabel(canonical),
    kind: classifyTarget(canonical),
    totalUsdc: formatUnits(totalUnits, 6),
    trustWeightedUsdc,
    unscoredStakers,
    claims: [...claims]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((row) => toPublicClaim(row, scores)),
    complete: loaded.complete,
    partial: loaded.partial,
  };
}
