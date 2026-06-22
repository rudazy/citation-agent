import { NextResponse } from "next/server";
import {
  getAgentWalletStatus,
  provisionAgentWallet,
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
    label: "Circle Agent Stack funder",
    sellerAddress: getSellerAddress(),
    paymentReady: hasDistinctPaymentWallets(),
    configError,
  });
}

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Run `npm run generate-wallets` to configure the agent wallet in production." },
      { status: 403 },
    );
  }

  try {
    provisionAgentWallet();
    const status = await getAgentWalletStatus();
    return NextResponse.json({
      ...status,
      created: true,
      message: "Agent wallet created. Fund it on Arc Testnet via Circle faucet.",
      faucetUrl: "https://faucet.circle.com/",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create agent wallet" },
      { status: 500 },
    );
  }
}