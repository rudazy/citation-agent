import {
  createPublicClient,
  decodeFunctionData,
  formatUnits,
  http,
  type AbiEvent,
  type Log,
} from "viem";
import { arcTestnet } from "viem/chains";
import { ATTESTATION_ABI, getAttestationAddress } from "@/lib/attestation";
import {
  canonicalizeAttestationTarget,
  classifyTarget,
  formatTargetLabel,
} from "@/lib/attestation-client";
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
let indexCache: CacheEntry<IndexedAttestation[]> | null = null;
const CACHE_TTL_MS = 5_000;
/** Arc RPC rejects eth_getLogs ranges above 10_000 blocks (inclusive). */
const LOG_CHUNK_SIZE = BigInt(9_998);
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

function rpcClient() {
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

async function fetchLogsForEvent(
  contractAddress: `0x${string}`,
  event: AbiEvent,
): Promise<Log[]> {
  const client = rpcClient();
  const latest = await client.getBlockNumber();
  const start = deployFromBlock();
  const logs: Log[] = [];

  for (let from = start; from <= latest; from += LOG_CHUNK_SIZE + BigInt(1)) {
    const to = from + LOG_CHUNK_SIZE > latest ? latest : from + LOG_CHUNK_SIZE;
    const chunk = await client.getLogs({
      address: contractAddress,
      event,
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...chunk);
  }

  return logs;
}

async function fetchAttestedLogs(contractAddress: `0x${string}`) {
  const [current, legacy] = await Promise.all([
    fetchLogsForEvent(contractAddress, ATTESTED_EVENT_ABI),
    fetchLogsForEvent(contractAddress, ATTESTED_LEGACY_EVENT_ABI),
  ]);

  const seen = new Set<string>();
  const merged: Log[] = [];
  for (const log of [...current, ...legacy]) {
    const key = logDedupeKey(log);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(log);
  }

  return merged;
}

async function readOnChainClaims(target: string): Promise<IndexedAttestation[]> {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) return [];

  const client = rpcClient();
  const rows = await client.readContract({
    address: contractAddress,
    abi: ATTESTATION_ABI,
    functionName: "getAttestations",
    args: [target],
  });

  return rows.map((row) => ({
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

export async function fetchIndexedAttestations(): Promise<IndexedAttestation[]> {
  if (indexCache && Date.now() - indexCache.at < CACHE_TTL_MS) {
    return indexCache.data;
  }

  const contractAddress = getAttestationAddress();
  if (!contractAddress) return [];

  const client = rpcClient();
  const logs = await fetchAttestedLogs(contractAddress);

  const txCache = new Map<`0x${string}`, ReturnType<typeof decodeFunctionData>>();
  const blockCache = new Map<bigint, number>();
  const results: IndexedAttestation[] = [];

  for (const log of logs) {
    const txHash = log.transactionHash;
    if (!txHash) continue;

    let decoded = txCache.get(txHash);
    if (!decoded) {
      const tx = await client.getTransaction({ hash: txHash });
      try {
        decoded = decodeFunctionData({ abi: ATTESTATION_ABI, data: tx.input });
        txCache.set(txHash, decoded);
      } catch {
        continue;
      }
    }
    if (decoded.functionName !== "attest") continue;

    const [target, claim, amount] = decoded.args as [string, string, bigint];
    const blockNumber = log.blockNumber;
    let timestamp = 0;
    if (blockNumber) {
      const cached = blockCache.get(blockNumber);
      if (cached !== undefined) {
        timestamp = cached;
      } else {
        timestamp = Number((await client.getBlock({ blockNumber })).timestamp);
        blockCache.set(blockNumber, timestamp);
      }
    }

    const tx = await client.getTransaction({ hash: txHash });
    results.push({
      target,
      canonicalTarget: canonicalizeAttestationTarget(target),
      claim,
      amountUnits: amount,
      amountUsdc: formatUnits(amount, 6),
      staker: tx.from,
      timestamp,
      txHash,
    });
  }

  const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
  indexCache = { at: Date.now(), data: sorted };
  return sorted;
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

export async function getTargetSummaries(): Promise<TargetSummary[]> {
  if (summaryCache && Date.now() - summaryCache.at < CACHE_TTL_MS) {
    return summaryCache.data;
  }

  let rows = await fetchIndexedAttestations();
  rows = await supplementFromOnChain(rows);

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
  return summaries;
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
 */
export async function getBackingSummariesForTargets(
  targets: string[],
  options?: { forceOnChain?: boolean },
): Promise<TargetSummary[]> {
  const unique = [
    ...new Set(targets.map((t) => canonicalizeAttestationTarget(t)).filter(Boolean)),
  ];
  if (unique.length === 0) return [];

  const indexed = await getTargetSummaries();
  const byTarget = new Map(indexed.map((row) => [row.target, row]));

  const contractAddress = getAttestationAddress();
  if (!contractAddress) return [...byTarget.values()];

  const needsOnChain = options?.forceOnChain
    ? unique
    : unique.filter((target) => (byTarget.get(target)?.backerCount ?? 0) < 1);

  if (needsOnChain.length === 0) return [...byTarget.values()];

  const client = rpcClient();
  const onChainRows = await Promise.all(
    needsOnChain.map(async (target) => {
      const count = await client.readContract({
        address: contractAddress,
        abi: ATTESTATION_ABI,
        functionName: "attestationCount",
        args: [target],
      });
      if (count === BigInt(0)) return { target, rows: [] as IndexedAttestation[] };
      const rows = await readOnChainClaims(target);
      return { target, rows };
    }),
  );

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
}> {
  const canonical = canonicalizeAttestationTarget(target);
  let claims = (await fetchIndexedAttestations()).filter(
    (row) => row.canonicalTarget === canonical,
  );

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
  };
}