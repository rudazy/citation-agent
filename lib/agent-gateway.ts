import { GatewayClient } from "@circle-fin/x402-batching/client";
import { gatewayPayWithMemo } from "@/lib/gateway-pay";
import { isAgentWalletConfigured } from "@/lib/agent-wallet";
import { sellerConfigError } from "@/lib/payment-wallets";

const REDEPOSIT_THRESHOLD = BigInt(500_000);
const DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT ?? "1";

const ALLOWED_PATH_PREFIXES = ["/api/marketplace/", "/api/premium/"] as const;

export function isAllowedPayPath(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return ALLOWED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function resolvePayUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base =
    process.env.BASE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${normalized}`;
}

function normalizePrivateKey(): `0x${string}` {
  const privateKey = process.env.BUYER_PRIVATE_KEY;
  if (!privateKey || !isAgentWalletConfigured()) {
    throw new Error("Agent wallet not configured");
  }
  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
}

export async function createAgentGatewayClient(): Promise<GatewayClient> {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey: normalizePrivateKey(),
  });
}

export async function ensureAgentGatewayDeposit(gateway: GatewayClient): Promise<void> {
  const balances = await gateway.getBalances();
  if (balances.gateway.available >= REDEPOSIT_THRESHOLD) return;

  if (balances.wallet.balance > BigInt(0)) {
    await gateway.deposit(DEPOSIT_AMOUNT);
    return;
  }

  throw new Error(
    `Insufficient agent funds. Wallet ${balances.wallet.formatted ?? "0"} USDC, Gateway ${balances.gateway.formattedAvailable ?? "0"} USDC. Fund the agent wallet via Circle faucet, then deposit to Gateway.`,
  );
}

export async function depositAgentGateway(): Promise<{
  depositTxHash: string;
  gatewayAvailable: string;
}> {
  const gateway = await createAgentGatewayClient();
  const balances = await gateway.getBalances();

  if (balances.wallet.balance <= BigInt(0)) {
    throw new Error(
      `Agent wallet has no USDC to deposit. Fund ${gateway.address} via Circle faucet first.`,
    );
  }

  const result = await gateway.deposit(DEPOSIT_AMOUNT);
  const updated = await gateway.getBalances();
  return {
    depositTxHash: result.depositTxHash,
    gatewayAvailable: updated.gateway.formattedAvailable,
  };
}

export async function payWithAgentGateway(params: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  memo?: string;
  body?: unknown;
}) {
  const configError = sellerConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!isAllowedPayPath(params.path)) {
    throw new Error("Payment path not allowed");
  }

  const gateway = await createAgentGatewayClient();
  await ensureAgentGatewayDeposit(gateway);

  const url = resolvePayUrl(params.path);
  return gatewayPayWithMemo(gateway, url, {
    method: params.method ?? "GET",
    memo: params.memo,
    body: params.body,
  });
}