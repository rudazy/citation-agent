/**
 * Client orchestration for the user-paid TrustGate score lookup.
 *
 * The user's own wallet pays the oracle fee with a real on-chain USDC transfer
 * (no hot wallet, no backend payer). The flow: read the challenge or a cached
 * result from our server route, pay the fee via the connected wallet, then relay
 * the proof through the server to retrieve the score. Nothing throws to the UI.
 */

import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { ARC_USDC, switchToArcTestnet } from "@/lib/attestation-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import {
  buildPaymentProof,
  type OracleChallenge,
  type PaidTrustScore,
  type ScoreLookupResponse,
  type ScoreSettleResponse,
} from "@/lib/trustgate-paid";

export type PaidScoreResult =
  | { status: "ok"; score: PaidTrustScore }
  | { status: "cached"; score: PaidTrustScore | null }
  | { status: "cancelled" }
  | { status: "failed"; reason: string }
  | { status: "unconfigured" };

function isUserRejection(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    if ((err as { code?: unknown }).code === 4001) return true;
  }
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /user rejected|user denied/i.test(message);
}

async function waitForReceipt(
  ethereum: EthereumProvider,
  hash: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = (await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error(`Transaction reverted: ${hash}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Transaction confirmation timed out: ${hash}`);
}

/** Real on-chain USDC transfer of the challenge amount to the challenge recipient. */
async function payOracleFee(
  ethereum: EthereumProvider,
  account: `0x${string}`,
  challenge: OracleChallenge,
): Promise<`0x${string}`> {
  const value = parseUnits(challenge.amount, 6);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [challenge.recipient, value],
  });
  const txHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: ARC_USDC, data }],
  })) as `0x${string}`;
  await waitForReceipt(ethereum, txHash);
  return txHash;
}

export async function payAndFetchScore(params: {
  address: `0x${string}`;
  ethereum: EthereumProvider;
  account: `0x${string}`;
}): Promise<PaidScoreResult> {
  const { address, ethereum, account } = params;

  // 1. Cached result (no charge) or a fresh challenge to pay.
  let lookup: ScoreLookupResponse;
  try {
    const res = await fetch(`/api/trustgate/score?address=${address}`);
    lookup = (await res.json()) as ScoreLookupResponse;
  } catch {
    return { status: "failed", reason: "Could not reach the score service" };
  }

  if (lookup.status === "cached") return { status: "cached", score: lookup.score };
  if (lookup.status === "unconfigured") return { status: "unconfigured" };
  if (lookup.status === "error") return { status: "failed", reason: lookup.reason };

  const challenge = lookup.challenge;

  // 2. Pay the fee from the user's own wallet (MetaMask confirms the amount).
  let txHash: `0x${string}`;
  try {
    await switchToArcTestnet(ethereum);
    txHash = await payOracleFee(ethereum, account, challenge);
  } catch (err) {
    if (isUserRejection(err)) return { status: "cancelled" };
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "Payment failed",
    };
  }

  // 3. Relay the proof and read the score.
  const proof = buildPaymentProof({ txHash, from: account, network: challenge.network });
  try {
    const res = await fetch("/api/trustgate/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, proof }),
    });
    const settle = (await res.json()) as ScoreSettleResponse;
    if (settle.status === "ok") return { status: "ok", score: settle.score };
    if (settle.status === "unconfigured") return { status: "unconfigured" };
    return {
      status: "failed",
      reason: "reason" in settle ? settle.reason : "Score lookup failed",
    };
  } catch {
    return {
      status: "failed",
      reason: "Payment went through, but the score lookup failed. Try again shortly.",
    };
  }
}

type AgentScoreResponse =
  | { status: "ok"; score: PaidTrustScore }
  | { status: "cached"; score: PaidTrustScore | null }
  | { status: "unconfigured" }
  | { status: "failed"; reason: string }
  | { status: "error"; reason: string };

/**
 * Pay for a lookup with the browser's session agent wallet. The wallet signs and
 * pays server side (same encrypted-key path as attestations); the client only
 * triggers it. Funds and gas are checked server side before any transfer.
 */
export async function payWithSessionAgent(
  address: `0x${string}`,
): Promise<PaidScoreResult> {
  let data: AgentScoreResponse;
  try {
    const res = await fetch("/api/trustgate/score/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    data = (await res.json()) as AgentScoreResponse;
  } catch {
    return { status: "failed", reason: "Could not reach the score service" };
  }

  if (data.status === "ok") return { status: "ok", score: data.score };
  if (data.status === "cached") return { status: "cached", score: data.score };
  if (data.status === "unconfigured") return { status: "unconfigured" };
  return {
    status: "failed",
    reason: "reason" in data ? data.reason : "Score lookup failed",
  };
}
