import { NextRequest, NextResponse } from "next/server";
import { formatMarketplaceHelloMemo } from "@/lib/payment-memo";
import { withGateway, type GatewayContext } from "@/lib/x402";

const handler = async (_req: NextRequest, ctx: GatewayContext) => {
  const paymentMemo = ctx.paymentMemo ?? formatMarketplaceHelloMemo();

  return NextResponse.json({
    message: "hello, marketplace — you paid for this",
    paid_by: ctx.payer,
    amount_usdc: ctx.amountUsdc,
    settlement_id: ctx.gatewayTx,
    payment_memo: paymentMemo,
    network: "eip155:5042002",
  });
};

export async function GET(req: NextRequest) {
  return withGateway(handler, "$0.01", "/api/marketplace/hello")(req);
}