import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import {
  ARC_RPC_RATE_LIMIT_MESSAGE,
  arcHttpTransport,
  getPreferredArcRpcUrl,
  isRpcRateLimitError,
} from "@/lib/arc-rpc";
import { fetchGatewayBalanceSnapshot } from "@/lib/gateway-balances";
import { gatewayPayWithMemo } from "@/lib/gateway-pay";
import { GATEWAY_WALLET } from "@/lib/marketplace";
import { sellerConfigError } from "@/lib/payment-wallets";
import { resolveSiteOrigin } from "@/lib/site-url";

const REDEPOSIT_THRESHOLD = BigInt(500_000);
const DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT ?? "1";
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

const GATEWAY_DEPOSIT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ALLOWED_PATH_PREFIXES = ["/api/marketplace/", "/api/premium/"] as const;

/** Canonicalize an in-app API path; rejects traversal and absolute URLs. */
export function canonicalizePayPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.includes("\\") || trimmed.includes("..")) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;

  let url: URL;
  try {
    const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    url = new URL(withLeading, "http://localhost");
  } catch {
    return null;
  }

  if (url.hostname !== "localhost") return null;
  if (!url.pathname.startsWith("/api/")) return null;

  return `${url.pathname}${url.search}`;
}

export function isAllowedPayPath(path: string): boolean {
  const canonical = canonicalizePayPath(path);
  if (!canonical) return false;
  return ALLOWED_PATH_PREFIXES.some((prefix) => canonical.startsWith(prefix));
}

export function resolvePayUrl(path: string): string {
  const canonical = canonicalizePayPath(path);
  if (!canonical) {
    throw new Error("Invalid payment path");
  }

  return `${resolveSiteOrigin()}${canonical}`;
}

function normalizePrivateKey(privateKey: string): `0x${string}` {
  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
}

/**
 * Circle GatewayClient only accepts one RPC URL (no viem fallback transport).
 * Prefer alternate public endpoints when the Circle free RPC is rate-limited.
 */
export function createAgentGatewayClient(
  privateKey: `0x${string}`,
  rpcUrl?: string,
): GatewayClient {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey: normalizePrivateKey(privateKey),
    rpcUrl: rpcUrl ?? getPreferredArcRpcUrl(),
  });
}

function mapGatewayRpcError(error: unknown): never {
  if (isRpcRateLimitError(error)) {
    throw new Error(ARC_RPC_RATE_LIMIT_MESSAGE, { cause: error });
  }
  throw error instanceof Error ? error : new Error(String(error));
}

/**
 * Deposit via multi-RPC viem clients instead of GatewayClient.deposit().
 * GatewayClient pins a single public RPC and fails hard on "request limit reached"
 * during the pre-deposit balanceOf eth_call — the exact failure on marketplace fund.
 */
async function depositUsdcToGateway(
  privateKey: `0x${string}`,
  amount: string,
): Promise<{ depositTxHash: Hex; approvalTxHash?: Hex }> {
  const account = privateKeyToAccount(normalizePrivateKey(privateKey));
  const transport = arcHttpTransport();
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport,
  });

  const depositAmount = parseUnits(amount, 6);

  let walletBalance: bigint;
  try {
    walletBalance = await publicClient.readContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
  } catch (error) {
    mapGatewayRpcError(error);
  }

  if (walletBalance <= BigInt(0)) {
    throw new Error(
      `Agent wallet has no USDC to deposit. Fund ${account.address} via Circle faucet first.`,
    );
  }
  if (walletBalance < depositAmount) {
    throw new Error(
      `Insufficient wallet USDC. Have ${formatUnits(walletBalance, 6)}, need ${amount}`,
    );
  }

  let allowance: bigint;
  try {
    allowance = await publicClient.readContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, GATEWAY_WALLET],
    });
  } catch (error) {
    mapGatewayRpcError(error);
  }

  let approvalTxHash: Hex | undefined;
  if (allowance < depositAmount) {
    try {
      approvalTxHash = await walletClient.writeContract({
        address: ARC_USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [GATEWAY_WALLET, depositAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
    } catch (error) {
      if (approvalTxHash) {
        // Broadcast may have landed — do not invite a blind retry as "failed".
        throw new Error(
          `Approval transaction may have been submitted (${approvalTxHash}). Check Arcscan and retry deposit only if needed.`,
          { cause: error },
        );
      }
      mapGatewayRpcError(error);
    }
  }

  let depositTxHash: Hex | undefined;
  try {
    depositTxHash = await walletClient.writeContract({
      address: GATEWAY_WALLET,
      abi: GATEWAY_DEPOSIT_ABI,
      functionName: "deposit",
      args: [ARC_USDC, depositAmount],
      gas: BigInt(120_000),
    });
    await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
  } catch (error) {
    if (depositTxHash) {
      throw new Error(
        `Deposit transaction may have been submitted (${depositTxHash}). Check Arcscan before retrying.`,
        { cause: error },
      );
    }
    mapGatewayRpcError(error);
  }

  return { depositTxHash: depositTxHash!, approvalTxHash };
}

/**
 * Auto top-up Gateway when available balance is below threshold.
 * Uses multi-RPC deposit; gateway available balance from Circle API.
 */
export async function ensureAgentGatewayDeposit(privateKey: `0x${string}`): Promise<void> {
  const key = normalizePrivateKey(privateKey);
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: arcHttpTransport(),
  });

  let walletBalance = BigInt(0);
  try {
    walletBalance = await publicClient.readContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
  } catch (error) {
    mapGatewayRpcError(error);
  }

  const snapshot = await fetchGatewayBalanceSnapshot(account.address, "0");
  const availableUnits = parseUnits(snapshot.gateway.available || "0", 6);
  if (availableUnits >= REDEPOSIT_THRESHOLD) return;

  if (walletBalance > BigInt(0)) {
    await depositUsdcToGateway(key, DEPOSIT_AMOUNT);
    return;
  }

  throw new Error(
    `Insufficient agent funds. Wallet ${formatUnits(walletBalance, 6)} USDC, Gateway ${snapshot.gateway.available} USDC. Fund your agent wallet via Circle faucet, then deposit to Gateway.`,
  );
}

export async function depositAgentGateway(
  privateKey: `0x${string}`,
  amount: string = DEPOSIT_AMOUNT,
): Promise<{
  depositTxHash: string;
  gatewayAvailable: string;
}> {
  const key = normalizePrivateKey(privateKey);
  const account = privateKeyToAccount(key);

  const { depositTxHash } = await depositUsdcToGateway(key, amount);

  // Gateway balances come from Circle's API (not Arc RPC).
  const snapshot = await fetchGatewayBalanceSnapshot(account.address, "0");
  return {
    depositTxHash,
    gatewayAvailable: snapshot.gateway.available,
  };
}

export async function payWithAgentGateway(
  params: {
    path: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    memo?: string;
    body?: unknown;
  },
  privateKey: `0x${string}`,
) {
  const configError = sellerConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!isAllowedPayPath(params.path)) {
    throw new Error("Payment path not allowed");
  }

  const key = normalizePrivateKey(privateKey);
  await ensureAgentGatewayDeposit(key);

  const gateway = createAgentGatewayClient(key);
  const url = resolvePayUrl(params.path);
  return gatewayPayWithMemo(gateway, url, {
    method: params.method ?? "GET",
    memo: params.memo,
    body: params.body,
  });
}
