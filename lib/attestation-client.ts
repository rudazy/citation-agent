import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { arcTestnet } from "viem/chains";
import { ATTESTATION_ABI, MIN_STAKE_UNITS } from "@/lib/attestation";

export const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
export const ARC_TESTNET_HEX = "0x4cef52" as const;

const RPC =
  process.env.NEXT_PUBLIC_ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";

export const ARC_TESTNET_ADD_CHAIN = {
  chainId: ARC_TESTNET_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [RPC],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
} as const;

import type { EthereumProvider } from "@/lib/ethereum-provider";

export type { EthereumProvider };

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC),
});

export type TargetPreset = "x" | "wallet" | "website" | "linkedin" | "agent" | "custom";

export type TargetKind = "wallet" | "website" | "social" | "linkedin" | "agent" | "other";

export function classifyTarget(target: string): TargetKind {
  const t = target.trim();
  if (/^agent:/i.test(t)) return "agent";
  if (/^0x[a-fA-F0-9]{40}$/i.test(t)) return "wallet";
  if (/linkedin\.com\//i.test(t) || /^linkedin:/i.test(t)) return "linkedin";
  if (/^https?:\/\//i.test(t)) return "website";
  if (/^@/.test(t) || /^x:/i.test(t) || /(?:twitter|x)\.com\//i.test(t)) return "social";
  return "other";
}

export function inferTargetPreset(target: string): TargetPreset {
  const t = target.trim();
  if (/^agent:/i.test(t)) return "agent";
  const kind = classifyTarget(t);
  if (kind === "wallet") return "wallet";
  if (kind === "linkedin") return "linkedin";
  if (kind === "website") return "website";
  if (kind === "social") return "x";
  return "custom";
}

export function targetInputFromProp(target: string, preset: TargetPreset): string {
  const t = target.trim();
  if (!t) return "";
  if (preset === "agent" && /^agent:/i.test(t)) return t.slice(6);
  if (preset === "x") {
    const handleMatch = t.match(/(?:twitter|x)\.com\/([^/?#]+)/i);
    if (handleMatch) return `@${handleMatch[1]}`;
    if (t.startsWith("x:")) return t.slice(2).startsWith("@") ? t.slice(2) : `@${t.slice(2)}`;
    return t.startsWith("@") ? t : `@${t}`;
  }
  return t;
}

export function buildTargetFromPreset(preset: TargetPreset, raw: string): string {
  const input = raw.trim();
  if (!input) return "";

  switch (preset) {
    case "x": {
      if (/^https?:\/\//i.test(input)) return input;
      const handle = input.replace(/^@/, "").replace(/^x:/i, "");
      return handle ? `x:@${handle}` : "";
    }
    case "wallet": {
      const addr = input.startsWith("0x") ? input : `0x${input}`;
      return /^0x[a-fA-F0-9]{40}$/.test(addr) ? addr.toLowerCase() : "";
    }
    case "website": {
      if (/^https?:\/\//i.test(input)) return input;
      return `https://${input.replace(/^\/\//, "")}`;
    }
    case "linkedin": {
      if (/^https?:\/\//i.test(input)) return input;
      if (/^linkedin:/i.test(input)) return input;
      if (input.includes("linkedin.com")) return `https://${input.replace(/^\/\//, "")}`;
      return `https://linkedin.com/in/${input.replace(/^\/+/, "")}`;
    }
    case "agent": {
      if (/^agent:/i.test(input)) return input;
      const bare = input.replace(/^agent:/i, "").trim();
      if (/^0x[a-fA-F0-9]{40}$/i.test(bare) || bare.startsWith("0x")) {
        const addr = bare.startsWith("0x") ? bare : `0x${bare}`;
        return /^0x[a-fA-F0-9]{40}$/i.test(addr) ? `agent:${addr.toLowerCase()}` : "";
      }
      const slug = bare.replace(/^@/, "").replace(/\s+/g, "-").toLowerCase();
      return slug ? `agent:${slug}` : "";
    }
    case "custom":
    default:
      return input;
  }
}

export function validateTargetInput(preset: TargetPreset, raw: string): string | null {
  const built = buildTargetFromPreset(preset, raw);
  if (!built) return "Enter a target value";

  switch (preset) {
    case "wallet":
      if (!/^0x[a-fA-F0-9]{40}$/.test(built)) {
        return "Enter a valid wallet or contract address (0x + 40 hex chars)";
      }
      break;
    case "website":
      if (!/^https?:\/\/.+/i.test(built)) return "Enter a valid website URL";
      break;
    case "linkedin":
      if (!/linkedin\.com\//i.test(built) && !/^linkedin:/i.test(built)) {
        return "Enter a LinkedIn profile or company URL";
      }
      break;
    case "x":
      if (built.length < 4) return "Enter an X handle or profile URL";
      break;
    case "agent":
      if (!/^agent:.+/i.test(built) || built.length < 8) {
        return "Enter an agent wallet (0x…) or agent id";
      }
      break;
    case "custom":
      if (built.length < 3) return "Custom target must be at least 3 characters";
      break;
  }

  return null;
}

/** Normalize on-chain target keys so @trustgated and x:@trustgated group together. */
export function canonicalizeAttestationTarget(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^0x[a-fA-F0-9]{40}$/i.test(t)) return t.toLowerCase();
  if (/^agent:/i.test(t)) {
    const rest = t.slice(6).trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(rest)) return `agent:${rest.toLowerCase()}`;
    return `agent:${rest.replace(/^@/, "").toLowerCase()}`;
  }
  if (/^https?:\/\//i.test(t)) return t;
  const profileMatch = t.match(/(?:twitter|x)\.com\/([^/?#]+)/i);
  if (profileMatch?.[1]) return `x:@${profileMatch[1].toLowerCase()}`;
  if (/^x:@/i.test(t)) return `x:@${t.slice(3).replace(/^@/, "").toLowerCase()}`;
  if (t.startsWith("@")) return `x:@${t.slice(1).toLowerCase()}`;
  return t;
}

export function formatTargetLabel(target: string): string {
  const t = target.trim();
  if (t.length <= 42) return t;
  return `${t.slice(0, 20)}…${t.slice(-16)}`;
}

export function getAttestationContractAddress(): `0x${string}` | null {
  const address = process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  return address as `0x${string}`;
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
      if (receipt.status === "0x0") {
        throw new Error(`Transaction reverted: ${hash}`);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Transaction confirmation timed out: ${hash}`);
}

export async function switchToArcTestnet(ethereum: EthereumProvider): Promise<void> {
  const current = (await ethereum.request({ method: "eth_chainId" })) as string;
  if (current.toLowerCase() === ARC_TESTNET_HEX) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET_HEX }],
    });
  } catch (switchError) {
    const err = switchError as { code?: number };
    if (err.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [ARC_TESTNET_ADD_CHAIN],
      });
      return;
    }
    throw switchError;
  }
}

export async function getConnectedAccount(
  ethereum: EthereumProvider,
): Promise<`0x${string}`> {
  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts[0]) throw new Error("No wallet account selected");
  return accounts[0] as `0x${string}`;
}

export async function readWalletUsdcBalance(address: `0x${string}`): Promise<string> {
  const balance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return formatUnits(balance, 6);
}

export async function attestViaConnectedWallet(params: {
  ethereum: EthereumProvider;
  account: `0x${string}`;
  contractAddress: `0x${string}`;
  target: string;
  claim: string;
  stakeUsdc: number;
}): Promise<{ approvalTxHash?: string; attestTxHash: string }> {
  const { ethereum, account, contractAddress, target, claim, stakeUsdc } = params;
  const amount = parseUnits(stakeUsdc.toFixed(6), 6);
  if (amount < MIN_STAKE_UNITS) {
    throw new Error("Minimum stake is 0.1 USDC");
  }
  if (!claim.trim()) throw new Error("Claim is required");

  await switchToArcTestnet(ethereum);

  const walletBalance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
  if (walletBalance < amount) {
    throw new Error(
      `Insufficient USDC. Have ${formatUnits(walletBalance, 6)}, need ${stakeUsdc}`,
    );
  }

  const allowance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, contractAddress],
  });

  let approvalTxHash: string | undefined;
  if (allowance < amount) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress, amount],
    });
    approvalTxHash = (await ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to: ARC_USDC, data: approveData }],
    })) as string;
    await waitForReceipt(ethereum, approvalTxHash);
  }

  const attestData = encodeFunctionData({
    abi: ATTESTATION_ABI,
    functionName: "attest",
    args: [target.trim(), claim.trim(), amount],
  });

  const attestTxHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: contractAddress, data: attestData, gas: "0x7a120" }],
  })) as string;
  await waitForReceipt(ethereum, attestTxHash);

  return { approvalTxHash, attestTxHash };
}

export type AgentWalletStatusResponse = {
  configured: boolean;
  address: `0x${string}` | null;
  usdcBalance: string | null;
  gatewayUsdc: string | null;
  nativeGas?: string | null;
  gateway?: {
    total: string;
    available: string;
    withdrawing: string;
    withdrawable: string;
  } | null;
  canProvision: boolean;
  faucetUrl?: string;
  label?: string;
  sellerAddress?: `0x${string}` | null;
  paymentReady?: boolean;
  configError?: string | null;
};

export async function fetchAgentWalletStatus(): Promise<AgentWalletStatusResponse> {
  const res = await fetch("/api/agent-wallet");
  if (!res.ok) {
    throw new Error("Failed to load agent wallet status");
  }
  return (await res.json()) as AgentWalletStatusResponse;
}

export async function provisionAgentWallet(): Promise<AgentWalletStatusResponse & { created?: boolean }> {
  const res = await fetch("/api/agent-wallet", { method: "POST" });
  const data = (await res.json()) as AgentWalletStatusResponse & { error?: string; created?: boolean };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to create agent wallet");
  }
  return data;
}

export async function attestViaAgentWallet(params: {
  target: string;
  claim: string;
  stakeUsdc: number;
}): Promise<{ attestTxHash: string; staker: string }> {
  const res = await fetch("/api/attestation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    error?: string;
    attestTxHash?: string;
    staker?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Agent attestation failed");
  }
  if (!data.attestTxHash || !data.staker) {
    throw new Error("Invalid response from attestation API");
  }
  return { attestTxHash: data.attestTxHash, staker: data.staker };
}