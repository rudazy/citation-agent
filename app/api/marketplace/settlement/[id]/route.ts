import { NextRequest, NextResponse } from "next/server";
import { GATEWAY_API } from "@/lib/marketplace";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const r = await fetch(`${GATEWAY_API}/v1/x402/transfers/${id}`);
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}