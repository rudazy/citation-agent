import { NextResponse } from "next/server";
import { depositAgentGateway } from "@/lib/agent-gateway";
import { isAgentWalletConfigured } from "@/lib/agent-wallet";

export async function POST() {
  if (!isAgentWalletConfigured()) {
    return NextResponse.json({ error: "Agent wallet not configured" }, { status: 500 });
  }

  try {
    const result = await depositAgentGateway();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway deposit failed" },
      { status: 500 },
    );
  }
}