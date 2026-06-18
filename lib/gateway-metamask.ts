import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { arcTestnet } from "viem/chains";
import { GATEWAY_WALLET } from "@/lib/marketplace";

const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
const RPC = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";

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

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC),
});

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

export async function getWalletUsdcBalance(address: `0x${string}`): Promise<string> {
  const balance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return formatUnits(balance, 6);
}

export async function depositToGatewayViaMetaMask(
  ethereum: EthereumProvider,
  account: `0x${string}`,
  amount: string,
): Promise<{ approvalTxHash?: string; depositTxHash: string }> {
  const depositAmount = parseUnits(amount, 6);

  const walletBalance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
  if (walletBalance < depositAmount) {
    throw new Error(
      `Insufficient wallet USDC. Have ${formatUnits(walletBalance, 6)}, need ${amount}`,
    );
  }

  const allowance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, GATEWAY_WALLET],
  });

  let approvalTxHash: string | undefined;
  if (allowance < depositAmount) {
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [GATEWAY_WALLET, depositAmount],
    });
    approvalTxHash = (await ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to: ARC_USDC, data: approveData }],
    })) as string;
    await waitForReceipt(ethereum, approvalTxHash);
  }

  const depositData = encodeFunctionData({
    abi: GATEWAY_DEPOSIT_ABI,
    functionName: "deposit",
    args: [ARC_USDC, depositAmount],
  });
  const depositTxHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: GATEWAY_WALLET, data: depositData, gas: "0x1d4c0" }],
  })) as string;
  await waitForReceipt(ethereum, depositTxHash);

  return { approvalTxHash, depositTxHash };
}