/**
 * Paid TrustGate lookup by creator post id (wallet hidden from client).
 */

import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { ARC_USDC, switchToArcTestnet } from "@/lib/attestation-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import type { PublicTrustSignal } from "@/lib/creator-trust";
import { paidScoreToSignal } from "@/lib/creator-trust";
import {
  buildPaymentProof,
  type OracleChallenge,
  type PaidTrustScore,
  type ScoreLookupResponse,
  type ScoreSettleResponse,
} from "@/lib/trustgate-paid";

export type PostTrustResult =
  | { status: "ok"; trust: PublicTrustSignal }
  | { status: "cached"; trust: PublicTrustSignal | null }
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

function toTrust(score: PaidTrustScore | null, postId: string): PublicTrustSignal | null {
  return score ? paidScoreToSignal(score, postId) : null;
}

export async function payAndFetchTrustByPostId(params: {
  postId: string;
  ethereum: EthereumProvider;
  account: `0x${string}`;
}): Promise<PostTrustResult> {
  const { postId, ethereum, account } = params;
  const q = encodeURIComponent(postId);

  let lookup: ScoreLookupResponse;
  try {
    const res = await fetch(`/api/trustgate/score?postId=${q}`);
    lookup = (await res.json()) as ScoreLookupResponse;
  } catch {
    return { status: "failed", reason: "Could not reach the score service" };
  }

  if (lookup.status === "cached") {
    return { status: "cached", trust: toTrust(lookup.score, postId) };
  }
  if (lookup.status === "unconfigured") return { status: "unconfigured" };
  if (lookup.status === "error") return { status: "failed", reason: lookup.reason };

  const challenge = lookup.challenge;
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

  const proof = buildPaymentProof({ txHash, from: account, network: challenge.network });
  try {
    const res = await fetch("/api/trustgate/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, proof }),
    });
    const settle = (await res.json()) as ScoreSettleResponse;
    if (settle.status === "ok") {
      return { status: "ok", trust: paidScoreToSignal(settle.score, postId) };
    }
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

type AgentPostTrustResponse =
  | { status: "ok"; score: PaidTrustScore }
  | { status: "cached"; score: PaidTrustScore | null }
  | { status: "unconfigured" }
  | { status: "failed"; reason: string }
  | { status: "error"; reason: string };

export async function payTrustByPostIdWithAgent(postId: string): Promise<PostTrustResult> {
  let data: AgentPostTrustResponse;
  try {
    const res = await fetch("/api/trustgate/score/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    data = (await res.json()) as AgentPostTrustResponse;
  } catch {
    return { status: "failed", reason: "Could not reach the score service" };
  }

  if (data.status === "ok" && data.score) {
    return { status: "ok", trust: paidScoreToSignal(data.score, postId) };
  }
  if (data.status === "cached") {
    return { status: "cached", trust: toTrust(data.score, postId) };
  }
  if (data.status === "unconfigured") return { status: "unconfigured" };
  return {
    status: "failed",
    reason: "reason" in data ? data.reason : "Score lookup failed",
  };
}