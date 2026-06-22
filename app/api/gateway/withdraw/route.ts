import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { isAgentWalletConfigured } from "@/lib/agent-wallet";
import {
  formatWithdrawError,
  getWithdrawWalletAddress,
  isSupportedWithdrawChain,
  withdrawGatewayFunds,
  type WithdrawRole,
} from "@/lib/gateway-withdraw";
import { getSellerPrivateKey } from "@/lib/payment-wallets";

const bodySchema = z.object({
  role: z.enum(["seller", "agent"]).default("seller"),
  amount: z.string().min(1),
  destinationChain: z.string().min(1),
  destinationAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isSupportedWithdrawChain(body.destinationChain)) {
    return NextResponse.json(
      { error: `Unsupported chain: ${body.destinationChain}` },
      { status: 400 },
    );
  }

  const role = body.role as WithdrawRole;

  if (role === "seller" && !getSellerPrivateKey()) {
    return NextResponse.json(
      {
        error:
          "SELLER_PRIVATE_KEY not configured. Run npm run generate-wallets — existing buyer keys are preserved.",
      },
      { status: 400 },
    );
  }

  if (role === "agent" && !isAgentWalletConfigured()) {
    return NextResponse.json(
      { error: "Agent wallet not configured. Run npm run generate-wallets or create an agent wallet." },
      { status: 400 },
    );
  }

  const supabase = getAdminClient();
  let withdrawalId: string | null = null;

  if (supabase && role === "seller") {
    const { data: withdrawal, error: insertError } = await supabase
      .from("withdrawals")
      .insert({
        amount_usdc: body.amount,
        destination_chain: body.destinationChain,
        destination_address: body.destinationAddress ?? null,
        status: "submitted",
      })
      .select()
      .single();

    if (insertError) {
      console.warn("[withdraw] Supabase record skipped:", insertError.message);
    } else {
      withdrawalId = withdrawal.id;
    }
  }

  try {
    const { walletAddress, result } = await withdrawGatewayFunds({
      role,
      amount: body.amount,
      destinationChain: body.destinationChain,
      destinationAddress: body.destinationAddress as `0x${string}` | undefined,
    });

    if (supabase && withdrawalId) {
      await supabase
        .from("withdrawals")
        .update({ status: "confirmed", tx_hash: result.mintTxHash })
        .eq("id", withdrawalId);
    }

    return NextResponse.json({
      id: withdrawalId,
      role,
      txHash: result.mintTxHash,
      amount: result.formattedAmount,
      sourceChain: result.sourceChain,
      destinationChain: result.destinationChain,
      recipient: result.recipient,
      walletAddress,
      status: "confirmed",
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);

    if (supabase && withdrawalId) {
      await supabase.from("withdrawals").update({ status: "failed" }).eq("id", withdrawalId);
    }

    let walletAddress = "unknown";
    try {
      walletAddress = await getWithdrawWalletAddress(role);
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        error: formatWithdrawError(raw, walletAddress, body.destinationChain),
      },
      { status: 500 },
    );
  }
}