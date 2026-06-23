/**
 * Client helpers to unlock paywalled citation bodies via x402 Gateway.
 */

import { payViaAgentWallet } from "@/lib/gateway-pay";
import { formatCitationPaymentMemo } from "@/lib/payment-memo";
import { payGatewayWithMetaMask } from "@/lib/x402-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";

export type CitationUnlockPayload = {
  citation?: {
    id?: string;
    title?: string;
    author?: string;
    subheading?: string;
    body?: string;
    price_usdc?: string;
  };
  error?: string;
  reason?: string;
};

export type CitationUnlockResult =
  | { status: "ok"; body: string; subheading?: string; amountUsdc?: string }
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

function extractBody(data: unknown): { body?: string; subheading?: string } {
  if (!data || typeof data !== "object") return {};
  const citation = (data as CitationUnlockPayload).citation;
  return {
    body: citation?.body,
    subheading: citation?.subheading,
  };
}

function failureReason(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const obj = data as CitationUnlockPayload;
    if (obj.reason) return obj.reason;
    if (obj.error) return obj.error;
  }
  return `Unlock failed (${status})`;
}

export async function unlockCitationViaMetaMask(params: {
  listingId: string;
  author: string;
  account: `0x${string}`;
  ethereum: EthereumProvider;
}): Promise<CitationUnlockResult> {
  const path = `/api/marketplace/citations?id=${encodeURIComponent(params.listingId)}`;
  const memo = formatCitationPaymentMemo(params.listingId, params.author);

  try {
    const result = await payGatewayWithMetaMask({
      path,
      account: params.account,
      ethereum: params.ethereum,
      memo,
    });

    if (!result.ok) {
      return { status: "failed", reason: failureReason(result.data, result.status) };
    }

    const { body, subheading } = extractBody(result.data);
    if (!body) {
      return { status: "failed", reason: "Payment succeeded but body was not released" };
    }

    return { status: "ok", body, subheading };
  } catch (err) {
    if ((err as { code?: number }).code === 4001) {
      return { status: "cancelled" };
    }
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "MetaMask unlock failed",
    };
  }
}

export async function unlockCitationViaAgent(params: {
  listingId: string;
  author: string;
}): Promise<CitationUnlockResult> {
  const path = `/api/marketplace/citations?id=${encodeURIComponent(params.listingId)}`;
  const memo = formatCitationPaymentMemo(params.listingId, params.author);

  try {
    const result = await payViaAgentWallet({ path, method: "GET", memo });
    const { body, subheading } = extractBody(result.data);

    if (!body) {
      return { status: "failed", reason: "Payment succeeded but body was not released" };
    }

    return {
      status: "ok",
      body,
      subheading,
      amountUsdc: result.formattedAmount,
    };
  } catch (err) {
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "Agent unlock failed",
    };
  }
}