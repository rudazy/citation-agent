import {
  GatewayClient,
  GATEWAY_DOMAINS,
  type SupportedChainName,
} from "@circle-fin/x402-batching/client";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { isAgentWalletConfigured } from "@/lib/agent-wallet";
import { getSellerPrivateKey } from "@/lib/payment-wallets";

export type WithdrawRole = "seller" | "agent";

export const WITHDRAW_CHAIN_LABELS: Record<string, string> = {
  arcTestnet: "Arc Testnet",
  baseSepolia: "Base Sepolia",
  sepolia: "Ethereum Sepolia",
  arbitrumSepolia: "Arbitrum Sepolia",
  optimismSepolia: "Optimism Sepolia",
  avalancheFuji: "Avalanche Fuji",
  polygonAmoy: "Polygon Amoy",
};

const MIN_NATIVE_GAS = parseEther("0.003");
const GAS_TOP_UP = parseEther("0.01");
const RPC = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";

function normalizeKey(key: string): `0x${string}` {
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

export function isSupportedWithdrawChain(chain: string): chain is SupportedChainName {
  return chain in GATEWAY_DOMAINS;
}

function privateKeyForRole(role: WithdrawRole): `0x${string}` {
  if (role === "agent") {
    const buyerKey = process.env.BUYER_PRIVATE_KEY;
    if (!buyerKey || !isAgentWalletConfigured()) {
      throw new Error("Agent wallet not configured");
    }
    return normalizeKey(buyerKey);
  }

  const sellerKey = getSellerPrivateKey();
  if (!sellerKey) {
    throw new Error(
      "SELLER_PRIVATE_KEY not configured. Run npm run generate-wallets to add seller keys.",
    );
  }
  return sellerKey;
}

async function createGatewayForRole(role: WithdrawRole): Promise<GatewayClient> {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey: privateKeyForRole(role),
  });
}

export async function getWithdrawWalletAddress(role: WithdrawRole): Promise<`0x${string}`> {
  const gateway = await createGatewayForRole(role);
  return gateway.address;
}

/** Arc uses native USDC for gas — not ETH. Top up from buyer in development when possible. */
export async function ensureArcNativeGas(
  recipient: `0x${string}`,
  options?: { topUpPrivateKey?: `0x${string}` },
): Promise<void> {
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(RPC),
  });
  const native = await publicClient.getBalance({ address: recipient });
  if (native >= MIN_NATIVE_GAS) return;

  const topUpKey = options?.topUpPrivateKey;
  if (topUpKey) {
    const account = privateKeyToAccount(topUpKey);
    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(RPC),
    });
    const funderNative = await publicClient.getBalance({ address: account.address });
    if (funderNative > GAS_TOP_UP) {
      const hash = await walletClient.sendTransaction({
        to: recipient,
        value: GAS_TOP_UP,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return;
    }
  }

  throw new Error(
    `Wallet ${recipient} needs native USDC on Arc for gas. Fund it via https://faucet.circle.com/ (Arc gas is paid in USDC, not ETH).`,
  );
}

export async function withdrawGatewayFunds(params: {
  role: WithdrawRole;
  amount: string;
  destinationChain: SupportedChainName;
  destinationAddress?: `0x${string}`;
}) {
  if (!isSupportedWithdrawChain(params.destinationChain)) {
    throw new Error(`Unsupported chain: ${params.destinationChain}`);
  }

  const parsedAmount = Number(params.amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  const gateway = await createGatewayForRole(params.role);
  const isCrossChain = params.destinationChain !== "arcTestnet";

  const topUpKey =
    params.role === "seller" &&
    isAgentWalletConfigured() &&
    process.env.BUYER_PRIVATE_KEY
      ? normalizeKey(process.env.BUYER_PRIVATE_KEY)
      : undefined;

  await ensureArcNativeGas(gateway.address, { topUpPrivateKey: topUpKey });

  const balances = await gateway.getBalances();
  const available = Number(balances.gateway.formattedAvailable);
  if (available < parsedAmount) {
    throw new Error(
      `Insufficient Gateway balance: ${balances.gateway.formattedAvailable} USDC available, tried ${params.amount} USDC.`,
    );
  }

  if (isCrossChain) {
    const destGateway = new GatewayClient({
      chain: params.destinationChain,
      privateKey: privateKeyForRole(params.role),
    });
    try {
      const destBalances = await destGateway.getBalances();
      if (!destBalances.wallet.formatted || Number(destBalances.wallet.formatted) === 0) {
        const chainLabel = WITHDRAW_CHAIN_LABELS[params.destinationChain] ?? params.destinationChain;
        throw new Error(
          `Wallet ${destGateway.address} needs native gas on ${chainLabel} for cross-chain mint. Fund via that chain's testnet faucet.`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("needs native gas")) {
        throw error;
      }
    }
  }

  const result = await gateway.withdraw(params.amount, {
    chain: params.destinationChain,
    recipient: params.destinationAddress,
  });

  return {
    walletAddress: gateway.address,
    result,
  };
}

export function formatWithdrawError(
  raw: string,
  walletAddress: string,
  destinationChain: string,
): string {
  const chainLabel = WITHDRAW_CHAIN_LABELS[destinationChain] ?? destinationChain;
  const isCrossChain = destinationChain !== "arcTestnet";

  if (
    raw.includes("insufficient funds for gas") ||
    raw.includes("exceeds the balance of the account") ||
    raw.includes("gas required exceeds allowance")
  ) {
    return isCrossChain
      ? `Wallet ${walletAddress} needs native gas on ${chainLabel} for the cross-chain mint. Fund via that chain's testnet faucet.`
      : `Wallet ${walletAddress} needs native USDC on Arc for gas. Fund via https://faucet.circle.com/`;
  }

  return raw;
}