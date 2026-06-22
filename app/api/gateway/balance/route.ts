import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits, erc20Abi } from "viem";
import { arcTestnet } from "viem/chains";
import { fetchGatewayBalanceSnapshot } from "@/lib/gateway-balances";
import { getSellerAddress, getSellerPrivateKey, isSellerConfigured } from "@/lib/payment-wallets";

const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_TESTNET_RPC),
});

async function getWalletUsdcBalance(address: `0x${string}`): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: ARC_TESTNET_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    return formatUnits(balance, 6);
  } catch {
    return "0";
  }
}

async function getNativeGasBalance(address: `0x${string}`): Promise<string> {
  try {
    const balance = await publicClient.getBalance({ address });
    return formatUnits(balance, 18);
  } catch {
    return "0";
  }
}

export async function GET() {
  const sellerAddress = getSellerAddress();
  if (!sellerAddress) {
    return NextResponse.json({
      configured: false,
      walletAddress: null,
      nativeGas: "0",
      wallet: { balance: "0" },
      gateway: {
        total: "0",
        available: "0",
        withdrawing: "0",
        withdrawable: "0",
      },
      hint: "Run npm run generate-wallets to add SELLER_ADDRESS (existing buyer keys are preserved).",
      sellerKeyConfigured: false,
    });
  }

  try {
    const [walletBalance, nativeGas, snapshot] = await Promise.all([
      getWalletUsdcBalance(sellerAddress),
      getNativeGasBalance(sellerAddress),
      fetchGatewayBalanceSnapshot(sellerAddress, "0"),
    ]);

    return NextResponse.json({
      configured: isSellerConfigured(),
      sellerKeyConfigured: !!getSellerPrivateKey(),
      walletAddress: sellerAddress,
      nativeGas,
      wallet: { balance: walletBalance },
      gateway: snapshot.gateway,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Balance fetch error:", message);
    return NextResponse.json({
      configured: isSellerConfigured(),
      sellerKeyConfigured: !!getSellerPrivateKey(),
      walletAddress: sellerAddress,
      nativeGas: "0",
      wallet: { balance: "0" },
      gateway: {
        total: "0",
        available: "0",
        withdrawing: "0",
        withdrawable: "0",
      },
    });
  }
}