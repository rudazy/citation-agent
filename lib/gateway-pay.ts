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
  const data = (await res.json()) as AgentGatewayPayResponse & {
    error?: string;
    reason?: string;
  };
  if (!res.ok) {
    throw new Error(data.reason ?? data.error ?? "Agent gateway payment failed");
  }
  return data;
}

export async function withdrawGatewayViaApi(params: {
  role: "seller" | "agent";
  amount: string;
  destinationChain?: string;
  destinationAddress?: string;
}): Promise<{
  txHash: string;
  amount: string;
  destinationChain: string;
  recipient: string;
}> {
  const res = await fetch("/api/gateway/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: params.role,
      amount: params.amount,
      destinationChain: params.destinationChain ?? "arcTestnet",
      destinationAddress: params.destinationAddress,
    }),
  });
  const data = (await res.json()) as {
    txHash?: string;
    amount?: string;
    destinationChain?: string;
    recipient?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Gateway withdrawal failed");
  }
  if (!data.txHash || !data.amount || !data.destinationChain || !data.recipient) {
    throw new Error("Invalid withdrawal response");
  }
  return {
    txHash: data.txHash,
    amount: data.amount,
    destinationChain: data.destinationChain,
    recipient: data.recipient,
  };
}

export async function depositAgentGatewayViaApi(amount?: string): Promise<{
  depositTxHash: string;
  gatewayAvailable: string;
}> {
  const res = await fetch("/api/gateway/deposit", {
    method: "POST",
    headers: amount ? { "Content-Type": "application/json" } : undefined,
    body: amount ? JSON.stringify({ amount }) : undefined,
  });
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