import { NextResponse } from "next/server";
import { createPublicClient, formatUnits } from "viem";
import { arcTestnet } from "viem/chains";
import { arcHttpTransport, isRpcRateLimitError } from "@/lib/arc-rpc";
import { ATTESTATION_ABI, getAttestationAddress } from "@/lib/attestation";
import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import type { StakeRecord, StakeStatusCode } from "@/lib/attestation-stake";

/**
 * Individual stakes for a target, straight from the current contract.
 *
 * Separate from /api/attestation/claims on purpose: that route serves the
 * aggregated registry from an event index built by decoding `attest` calldata,
 * which never learns a stake's array index or status. Withdrawing needs both,
 * and only `getAttestations` returns them — the position in the array is the
 * index the contract expects.
 *
 * Read-only and public: every field here is already on a public chain.
 */
export const maxDuration = 30;

const LIVE_UNAVAILABLE =
  "Live chain data is temporarily unavailable. Try again shortly.";

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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawTarget = params.get("target")?.trim();
  if (!rawTarget) {
    return NextResponse.json({ error: "target is required" }, { status: 400 });
  }

  const contractAddress = getAttestationAddress();
  if (!contractAddress) {
    return NextResponse.json(
      { error: "Attestation contract is not configured" },
      { status: 500 },
    );
  }

  const target = canonicalizeAttestationTarget(rawTarget);

  let records: readonly ChainStake[];
  try {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: arcHttpTransport(),
    });
    records = (await client.readContract({
      address: contractAddress,
      abi: ATTESTATION_ABI,
      functionName: "getAttestations",
      args: [target],
    })) as readonly ChainStake[];
  } catch (err) {
    console.warn(
      "[attestation/stakes] read failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: LIVE_UNAVAILABLE },
      { status: isRpcRateLimitError(err) ? 503 : 502 },
    );
  }

  // Array position is the index `withdraw`/`reclaimExpiredFreeze` expect, so it
  // must be assigned before any filtering.
  const stakes: StakeRecord[] = records.map((row, index) => ({
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
  }));

  const staker = params.get("staker")?.trim().toLowerCase();
  const filtered = staker
    ? stakes.filter((s) => s.staker.toLowerCase() === staker)
    : stakes;

  return NextResponse.json(
    {
      target,
      contract: contractAddress,
      stakes: filtered,
      // Client clocks drift; anything time-based should be judged against this.
      nowSeconds: Math.floor(Date.now() / 1000),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
