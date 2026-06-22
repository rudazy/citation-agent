import { NextResponse } from "next/server";
import { depositAgentGateway } from "@/lib/agent-gateway";
import { requireUserAgent } from "@/lib/resolve-user-agent";

export async function POST() {
  try {
    const agent = await requireUserAgent();
    const result = await depositAgentGateway(agent.privateKey);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway deposit failed" },
      { status: err instanceof Error && err.message.includes("No agent wallet") ? 400 : 500 },
    );
  }
}