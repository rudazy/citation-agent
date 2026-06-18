import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  ARC_TESTNET_USDC,
  CANTEEN_USDC_ABI,
  getArcRpcUrl,
  getCanteenUsdcAddress,
} from "./canteen-usdc.ts";

export type CanteenRoyaltyResult = {
  creatorWallet: `0x${string}`;
  royaltyUsdc: string;
  wrapped: boolean;
  wrapTx: `0x${string}` | null;
};

export async function ensureCanteenRoyaltyReserve(
  royaltyTotalUsdc: string,
  funderPrivateKey: `0x${string}`,
): Promise<CanteenRoyaltyResult | null> {
  const canteenAddress = getCanteenUsdcAddress();
  if (!canteenAddress) {
    return null;
  }

  const account = privateKeyToAccount(funderPrivateKey);
  const rpcUrl = getArcRpcUrl();
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const required = parseUnits(royaltyTotalUsdc, 6);
  const current = await publicClient.readContract({
    address: canteenAddress,
    abi: CANTEEN_USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (current >= required) {
    return {
      creatorWallet: account.address,
      royaltyUsdc: royaltyTotalUsdc,
      wrapped: false,
      wrapTx: null,
    };
  }

  const shortfall = required - current;
  const approveHash = await walletClient.writeContract({
    address: ARC_TESTNET_USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [canteenAddress, shortfall],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const wrapHash = await walletClient.writeContract({
    address: canteenAddress,
    abi: CANTEEN_USDC_ABI,
    functionName: "wrap",
    args: [shortfall],
  });
  await publicClient.waitForTransactionReceipt({ hash: wrapHash });

  return {
    creatorWallet: account.address,
    royaltyUsdc: formatUnits(required, 6),
    wrapped: true,
    wrapTx: wrapHash,
  };
}