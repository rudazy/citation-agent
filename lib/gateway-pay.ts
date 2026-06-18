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