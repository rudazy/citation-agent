import { NextResponse } from "next/server";
import { z } from "zod";
import { depositAgentGateway } from "@/lib/agent-gateway";
import { requireUserAgent } from "@/lib/resolve-user-agent";

const bodySchema = z
  .object({
    amount: z.string().min(1).optional(),
  })
  .optional();

export async function POST(request: Request) {
  let amount: string | undefined;
  try {
    const raw = await request.json();
    const parsed = bodySchema.parse(raw);
    amount = parsed?.amount;
  } catch {
    // Empty body is valid — uses default deposit amount.
  }

  try {
    const agent = await requireUserAgent();
    const result = await depositAgentGateway(agent.privateKey, amount);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway deposit failed" },
      { status: err instanceof Error && err.message.includes("No agent wallet") ? 400 : 500 },
    );
  }
}