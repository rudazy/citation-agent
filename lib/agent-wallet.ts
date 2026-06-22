import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  formatUnits,
  http,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { fetchGatewayBalanceSnapshot } from "@/lib/gateway-balances";

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

function envLocalPath(): string {
  return path.resolve(process.cwd(), ".env.local");
}

function replaceOrAppend(content: string, key: string, line: string): string {
  const regex = new RegExp(`^${key}=.*$`, "m");
  return regex.test(content) ? content.replace(regex, line) : `${content.trimEnd()}\n${line}`;
}

export function isAgentWalletConfigured(): boolean {
  const key = process.env.BUYER_PRIVATE_KEY;
  return Boolean(key && key.length > 0 && !key.includes("YourBuyer"));
}

export function getAgentWalletAddress(): `0x${string}` | null {
  const fromEnv = process.env.BUYER_ADDRESS;
  if (fromEnv && /^0x[a-fA-F0-9]{40}$/.test(fromEnv)) {
    return fromEnv as `0x${string}`;
  }
  const key = process.env.BUYER_PRIVATE_KEY;
  if (!key) return null;
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  try {
    return privateKeyToAccount(normalized as `0x${string}`).address;
  } catch {
    return null;
  }
}

export async function getAgentWalletStatus(): Promise<AgentWalletStatus> {
  const configured = isAgentWalletConfigured();
  const address = getAgentWalletAddress();
  const canProvision = process.env.NODE_ENV === "development";

  if (!configured || !address) {
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

/** Dev-only: generate buyer agent wallet and persist to .env.local + process.env */
export function provisionAgentWallet(): { address: `0x${string}` } {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Agent wallet provisioning is only available in development");
  }
  if (isAgentWalletConfigured()) {
    const existing = getAgentWalletAddress();
    if (existing) return { address: existing };
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const envPath = envLocalPath();
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  content = replaceOrAppend(content, "BUYER_ADDRESS", `BUYER_ADDRESS=${account.address}`);
  content = replaceOrAppend(content, "BUYER_PRIVATE_KEY", `BUYER_PRIVATE_KEY=${privateKey}`);
  fs.writeFileSync(envPath, `${content.trimEnd()}\n`);

  process.env.BUYER_ADDRESS = account.address;
  process.env.BUYER_PRIVATE_KEY = privateKey;

  return { address: account.address };
}