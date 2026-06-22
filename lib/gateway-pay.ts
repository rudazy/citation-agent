import type { GatewayClient } from "@circle-fin/x402-batching/client";
import { PAYMENT_MEMO_HEADER } from "@/lib/payment-memo";

type GatewayPayOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  memo?: string;
};

/**
 * GatewayClient.pay() wrapper that forwards an Arc-style payment memo header
 * for server-side reconciliation (Circle SDK has no memo param on pay()).
 */
export async function gatewayPayWithMemo<T>(
  gateway: GatewayClient,
  url: string,
  options: GatewayPayOptions = {},
) {
  const { memo, headers, ...rest } = options;

  return gateway.pay<T>(url, {
    ...rest,
    headers: {
      ...headers,
      ...(memo ? { [PAYMENT_MEMO_HEADER]: memo } : {}),
    },
  });
}

export type AgentGatewayPayResponse = {
  data: unknown;
  formattedAmount: string;
  payer?: string;
  settlementId: string | null;
};

export async function payViaAgentWallet(params: {
  path: string;
  method?: "GET" | "POST";
  memo?: string;
  body?: unknown;
}): Promise<AgentGatewayPayResponse> {
  const res = await fetch("/api/gateway/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as AgentGatewayPayResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Agent gateway payment failed");
  }
  return data;
}

export async function depositAgentGatewayViaApi(): Promise<{
  depositTxHash: string;
  gatewayAvailable: string;
}> {
  const res = await fetch("/api/gateway/deposit", { method: "POST" });
  const data = (await res.json()) as {
    depositTxHash?: string;
    gatewayAvailable?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Gateway deposit failed");
  }
  if (!data.depositTxHash || !data.gatewayAvailable) {
    throw new Error("Invalid deposit response");
  }
  return {
    depositTxHash: data.depositTxHash,
    gatewayAvailable: data.gatewayAvailable,
  };
}