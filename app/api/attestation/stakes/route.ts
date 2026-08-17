import { NextResponse } from "next/server";
import { getAttestationAddress } from "@/lib/attestation";
import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import { isRpcRateLimitError } from "@/lib/arc-rpc";
import {
  loadStakesForStaker,
  readStakesForTarget,
} from "@/lib/attestation-stakes-query";

/**
 * Individual stakes from the current contract.
 *
 * Separate from /api/attestation/claims on purpose: that route serves the
 * aggregated registry from an event index built by decoding `attest` calldata,
 * which never learns a stake's array index or status. Withdrawing needs both,
 * and only `getAttestations` returns them — the position in the array is the
 * index the contract expects.
 *
 * `?target=` — every stake on that target (optional `?staker=` filter).
 * `?staker=` alone — that wallet's stakes across every target it has backed.
 *
 * Read-only and public: every field here is already on a public chain.
 */
export const maxDuration = 60;

const LIVE_UNAVAILABLE =
  "Live chain data is temporarily unavailable. Try again shortly.";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawTarget = params.get("target")?.trim();
  const rawStaker = params.get("staker")?.trim();

  if (!rawTarget && !rawStaker) {
    return NextResponse.json(
      { error: "target or staker is required" },
      { status: 400 },
    );
  }

  const contractAddress = getAttestationAddress();
  if (!contractAddress) {
    return NextResponse.json(
      { error: "Attestation contract is not configured" },
      { status: 500 },
    );
  }

  if (!rawTarget && rawStaker) {
    if (!ADDRESS_RE.test(rawStaker)) {
      return NextResponse.json({ error: "Invalid staker address" }, { status: 400 });
    }
    try {
      const { live, legacy, nowSeconds } = await loadStakesForStaker(
        rawStaker as `0x${string}`,
      );
      return NextResponse.json(
        {
          staker: rawStaker.toLowerCase(),
          contract: contractAddress,
          stakes: live,
          legacy,
          nowSeconds,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    } catch (err) {
      console.warn(
        "[attestation/stakes] wallet listing failed:",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: LIVE_UNAVAILABLE },
        { status: isRpcRateLimitError(err) ? 503 : 502 },
      );
    }
  }

  const target = canonicalizeAttestationTarget(rawTarget!);

  let stakes;
  try {
    stakes = await readStakesForTarget(target);
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

  const staker = rawStaker?.toLowerCase();
  const filtered = staker
    ? stakes.filter((s) => s.staker.toLowerCase() === staker)
    : stakes;

  return NextResponse.json(
    {
      target,
      contract: contractAddress,
      stakes: filtered,
      nowSeconds: Math.floor(Date.now() / 1000),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
