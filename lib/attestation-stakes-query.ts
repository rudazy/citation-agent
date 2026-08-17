/**
 * Load every live (v2) and leftover (v1) stake for one wallet.
 *
 * Discovery uses the claims index (one place that already knows every target
 * this wallet ever attested). State and the withdraw index come from
 * `getAttestations` on the current contract. Sequential RPC on purpose —
 * Arc public endpoints rate-limit parallel eth_call storms.
 */

import { createPublicClient, formatUnits } from "viem";
import { arcTestnet } from "viem/chains";
import { arcHttpTransport } from "@/lib/arc-rpc";
import { ATTESTATION_ABI, getAttestationAddress } from "@/lib/attestation";
import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import { fetchIndexedAttestationsResult } from "@/lib/attestation-index";
import {
  partitionWalletStakes,
  type IndexedStakeHint,
  type StakeRecord,
  type StakeStatusCode,
} from "@/lib/attestation-stake";
import { claimsLogsChunkDelayMs, sleep, withRpcRetry } from "@/lib/chunked-get-logs";

const MAX_TARGETS = 40;

type ChainStake = {
  staker: `0x${string}`;
  amount: bigint;
  claim: string;
  target: string;
  timestamp: bigint;
  unlockAt: bigint;
  frozenAt: bigint;
  firstFrozenAt: bigint;
  status: number;
};

export function toStakeRecord(row: ChainStake, index: number): StakeRecord {
  return {
    index,
    staker: row.staker,
    target: row.target,
    claim: row.claim,
    amountUsdc: formatUnits(row.amount, 6),
    timestamp: Number(row.timestamp),
    unlockAt: Number(row.unlockAt),
    frozenAt: Number(row.frozenAt),
    firstFrozenAt: Number(row.firstFrozenAt),
    status: row.status as StakeStatusCode,
  };
}

export async function readStakesForTarget(target: string): Promise<StakeRecord[]> {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) return [];

  const client = createPublicClient({
    chain: arcTestnet,
    transport: arcHttpTransport(),
  });
  const result = await withRpcRetry(`getAttestations ${target.slice(0, 24)}`, () =>
    client.readContract({
      address: contractAddress,
      abi: ATTESTATION_ABI,
      functionName: "getAttestations",
      args: [target],
    }),
  );
  if (!result.ok || !result.value) return [];
  return (result.value as readonly ChainStake[]).map(toStakeRecord);
}

export async function loadStakesForStaker(staker: `0x${string}`): Promise<{
  live: StakeRecord[];
  legacy: IndexedStakeHint[];
  nowSeconds: number;
}> {
  const key = staker.toLowerCase();
  const loaded = await fetchIndexedAttestationsResult();
  const indexed: IndexedStakeHint[] = loaded.rows
    .filter((row) => row.staker.toLowerCase() === key)
    .map((row) => ({
      // Raw calldata target — withdraw() requires this exact string.
      target: row.target,
      claim: row.claim,
      amountUsdc: row.amountUsdc,
      timestamp: row.timestamp,
      staker: row.staker,
      txHash: row.txHash,
    }));

  const targets = [
    ...new Set(
      indexed.flatMap((row) => {
        const canonical = canonicalizeAttestationTarget(row.target);
        return row.target === canonical ? [row.target] : [row.target, canonical];
      }),
    ),
  ].slice(0, MAX_TARGETS);

  const onChain: StakeRecord[] = [];
  const delayMs = claimsLogsChunkDelayMs();
  for (const target of targets) {
    const rows = await readStakesForTarget(target);
    onChain.push(
      ...rows.filter((row) => row.staker.toLowerCase() === key),
    );
    if (delayMs > 0) await sleep(delayMs);
  }

  const { live, legacy } = partitionWalletStakes(indexed, onChain);
  return {
    live,
    legacy,
    nowSeconds: Math.floor(Date.now() / 1000),
  };
}
