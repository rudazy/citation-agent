import { NextRequest, NextResponse } from "next/server";
import { getGatewayBalance } from "@/lib/gateway-balance";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Missing or invalid address" }, { status: 400 });
  }

  try {
    const { balance, pendingBatch } = await getGatewayBalance(address);
    return NextResponse.json({
      address,
      gateway_usdc: balance,
      pending_batch: pendingBatch,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e) },
      { status: 502 },
    );
  }
}