import {
  createPublicClient,
  formatUnits,
  http,
} from "viem";
import { arcTestnet } from "viem/chains";
import { ensureAgentSession } from "@/lib/agent-session";
import { fetchGatewayBalanceSnapshot } from "@/lib/gateway-balances";
import { hasUserAgentWallet } from "@/lib/resolve-user-agent";
import {
  getUserAgentWallet,
  provisionUserAgentWallet,
} from "@/lib/user-agent-wallet";

const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

export type AgentWalletStatus = {
  configured: boolean;
  address: `0x${string}` | null;
  usdcBalance: string | null;
  gatewayUsdc: string | null;
  nativeGas: string | null;
  gateway: {
    total: string;
    available: string;
    withdrawing: string;
    withdrawable: string;
  } | null;
  canProvision: boolean;
};

/** CLI / npm run agent funder — not used for in-app user wallets. */
export function isCliFunderConfigured(): boolean {
  const key = process.env.BUYER_PRIVATE_KEY;
  return Boolean(key && key.length > 0 && !key.includes("YourBuyer"));
}

/** @deprecated Use per-session wallets via resolveUserAgent(). Kept for CLI-only checks. */
export function isAgentWalletConfigured(): boolean {
  return isCliFunderConfigured();
}

export async function getAgentWalletStatus(): Promise<AgentWalletStatus> {
  const sessionId = await ensureAgentSession();
  const stored = await getUserAgentWallet(sessionId);
  const canProvision = true;

  if (!stored) {
    return {
      configured: false,
      address: null,
      usdcBalance: null,
      gatewayUsdc: null,
      nativeGas: null,
      gateway: null,
      canProvision,
    };
  }

  const address = stored.address;
  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  try {
    const [balance, nativeGas, snapshot] = await Promise.all([
      publicClient.readContract({
        address: ARC_USDC,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [address],
      }),
      publicClient.getBalance({ address }),
      fetchGatewayBalanceSnapshot(address, "0"),
    ]);
    return {
      configured: true,
      address,
      usdcBalance: formatUnits(balance, 6),
      gatewayUsdc: snapshot.gateway.available,
      nativeGas: formatUnits(nativeGas, 18),
      gateway: snapshot.gateway,
      canProvision,
    };
  } catch {
    return {
      configured: true,
      address,
      usdcBalance: null,
      gatewayUsdc: null,
      nativeGas: null,
      gateway: null,
      canProvision,
    };
  }
}

/** Creates a unique agent wallet for this browser session (stored encrypted in Supabase). */
export async function provisionAgentWalletForSession(): Promise<{ address: `0x${string}` }> {
  const sessionId = await ensureAgentSession();
  const { address } = await provisionUserAgentWallet(sessionId);
  return { address };
}

export async function isSessionAgentWalletConfigured(): Promise<boolean> {
  return hasUserAgentWallet();
}