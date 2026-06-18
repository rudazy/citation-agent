import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";

const handler = async (
  _req: NextRequest,
  ctx: { payer: string; gatewayTx: string | null; amountUsdc: string },
) => {
  return NextResponse.json({
    message: "hello, marketplace — you paid for this",
    paid_by: ctx.payer,
    amount_usdc: ctx.amountUsdc,
    settlement_id: ctx.gatewayTx,
    network: "eip155:5042002",
  });
};

export async function GET(req: NextRequest) {
  return withGateway(handler, "$0.01", "/api/marketplace/hello")(req);
}