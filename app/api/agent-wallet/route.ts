import { NextResponse, type NextRequest } from "next/server";
import {
  getAgentWalletStatus,
  provisionAgentWalletForSession,
} from "@/lib/agent-wallet";
import { parseRecoveryWallet } from "@/lib/recovery-wallet";
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

export async function POST(req: NextRequest) {
  let body: { recoveryWallet?: string } = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text) as { recoveryWallet?: string };
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recoveryWallet = parseRecoveryWallet(body.recoveryWallet);

  try {
    await provisionAgentWalletForSession({ recoveryWallet });
    const status = await getAgentWalletStatus();
    return NextResponse.json({
      ...status,
      created: true,
      message: recoveryWallet
        ? "Agent wallet created with pasted recovery address. Connect that MetaMask on any device to restore."
        : "Agent wallet created. Paste a recovery MetaMask address so you can restore on other devices.",
      faucetUrl: "https://faucet.circle.com/",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create agent wallet" },
      { status: 500 },
    );
  }
}