import { NextRequest, NextResponse } from "next/server";
import { withGateway, type GatewayContext } from "@/lib/x402";
import {
  formatTipPrice,
  parseTipAmountUsdc,
  resolveCreatorTipPayee,
} from "@/lib/creator-tip";
import { truncateMemo } from "@/lib/payment-memo";
import { normalizeUsernameInput } from "@/lib/username";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/marketplace/tip?username=&amount=
 * x402 Gateway payment that settles tip USDC to the creator payout wallet.
 */
export async function GET(req: NextRequest) {
  const usernameRaw = req.nextUrl.searchParams.get("username");
  const username = normalizeUsernameInput(usernameRaw ?? "");
  if (!username) {
    return NextResponse.json({ error: "Valid username is required" }, { status: 400 });
  }

  const amount = parseTipAmountUsdc(req.nextUrl.searchParams.get("amount") ?? "0.1");
  if (amount == null) {
    return NextResponse.json(
      { error: "Tip amount must be between 0.001 and 1000 USDC" },
      { status: 400 },
    );
  }

  const payee = await resolveCreatorTipPayee(username);
  if (!payee) {
    return NextResponse.json(
      { error: "Creator has no payout wallet yet" },
      { status: 404 },
    );
  }

  const price = formatTipPrice(amount);
  const endpoint = `/api/marketplace/tip?username=${encodeURIComponent(payee.username)}&amount=${encodeURIComponent(String(amount))}`;

  const handler = async (_req: NextRequest, ctx: GatewayContext) => {
    const rate = checkRateLimit(ctx.payer, {
      namespace: "creator-tip",
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many tips. Please wait." },
        { status: 429 },
      );
    }

    const paymentMemo =
      ctx.paymentMemo ??
      truncateMemo(`tip:@${payee.username} amount:${amount}`);

    return NextResponse.json({
      ok: true,
      tip: {
        username: payee.username,
        amount_usdc: amount.toString(),
        paid_by: ctx.payer,
        settled_to: ctx.payTo,
      },
      settlement_id: ctx.gatewayTx,
      payment_memo: paymentMemo,
      network: "eip155:5042002",
    });
  };

  return withGateway(handler, price, endpoint, payee.payTo)(req);
}
