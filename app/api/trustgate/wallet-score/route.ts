import { NextResponse } from "next/server";
import { trustScoreToSignal } from "@/lib/creator-trust";
import { getTrustScore } from "@/lib/trustgate";
import { isAddress } from "@/lib/trustgate-paid";

/**
 * GET ?address=0x… — rescored wallet trust (matches trustgated.xyz oracle playground).
 */
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Valid address required" }, { status: 400 });
  }

  const score = await getTrustScore(address);
  return NextResponse.json({
    trust: trustScoreToSignal(score, "free"),
  });
}