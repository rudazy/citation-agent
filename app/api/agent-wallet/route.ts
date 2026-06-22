import { NextResponse } from "next/server";
import {
  getAgentWalletStatus,
  provisionAgentWalletForSession,
} from "@/lib/agent-wallet";
import {
  getSellerAddress,
  hasDistinctPaymentWallets,
  sellerConfigError,
} from "@/lib/payment-wallets";

export async function GET() {
  const status = await getAgentWalletStatus();
  const configError = sellerConfigError();
  return NextResponse.json({
    ...status,
    faucetUrl: "https://faucet.circle.com/",
    label: "Your Arc agent wallet",
    sellerAddress: getSellerAddress(),
    paymentReady: hasDistinctPaymentWallets(),
    configError,
  });
}

export async function POST() {
  try {
    const { address } = await provisionAgentWalletForSession();
    const status = await getAgentWalletStatus();
    return NextResponse.json({
      ...status,
      created: true,
      message:
        "Real Arc agent wallet created. Fund this address with testnet USDC via the Circle faucet, then deposit to Gateway to pay.",
      faucetUrl: "https://faucet.circle.com/",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create agent wallet" },
      { status: 500 },
    );
  }
}