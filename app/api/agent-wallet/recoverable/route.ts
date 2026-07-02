import { NextResponse, type NextRequest } from "next/server";
import { getAddress } from "viem";
import { getUserAgentWalletByLinkedWallet } from "@/lib/user-agent-wallet";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("address")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  let linkedWallet: `0x${string}`;
  try {
    linkedWallet = getAddress(raw);
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const wallet = await getUserAgentWalletByLinkedWallet(linkedWallet);
  return NextResponse.json({
    recoverable: wallet !== null,
    agentAddress: wallet?.address ?? null,
  });
}