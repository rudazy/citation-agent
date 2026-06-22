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
};

/** JSON-safe claim row for API responses (no bigint). */
export type PublicClaim = {
  target: string;
  claim: string;
  amountUsdc: string;
  staker: `0x${string}`;
  timestamp: number;
  txHash: `0x${string}` | null;
};

function toPublicClaim(row: IndexedAttestation): PublicClaim {
  return {
    target: row.canonicalTarget,
    claim: row.claim,
    amountUsdc: row.amountUsdc,
    staker: row.staker,
    timestamp: row.timestamp,
    txHash: row.txHash,
  };
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
  const byTarget = new Map<string, { total: bigint; count: number; displayTarget: string }>();

  for (const row of rows) {
    const key = row.canonicalTarget;
    const existing = byTarget.get(key);
    if (existing) {
      existing.total += row.amountUnits;
      existing.count += 1;
    } else {
      byTarget.set(key, { total: row.amountUnits, count: 1, displayTarget: key });
    }
  }

  const summaries = [...byTarget.entries()]
    .map(([target, meta]) => ({
      target,
      label: formatTargetLabel(target),
      kind: classifyTarget(target),
      totalUsdc: formatUnits(meta.total, 6),
      claimCount: meta.count,
    }))
    .sort((a, b) => parseFloat(b.totalUsdc) - parseFloat(a.totalUsdc));

  summaryCache = { at: Date.now(), data: summaries };
  return summaries;
}

export async function getTargetClaims(target: string): Promise<{
  target: string;
  label: string;
  kind: ReturnType<typeof classifyTarget>;
  totalUsdc: string;
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

  return {
    target: canonical,
    label: formatTargetLabel(canonical),
    kind: classifyTarget(canonical),
    totalUsdc: formatUnits(totalUnits, 6),
    claims: [...claims]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(toPublicClaim),
  };
}