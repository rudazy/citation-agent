import { NextResponse } from "next/server";
import { z } from "zod";
import { depositAgentGateway } from "@/lib/agent-gateway";
import { ARC_RPC_RATE_LIMIT_MESSAGE, isRpcRateLimitError } from "@/lib/arc-rpc";
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
    const message = err instanceof Error ? err.message : "Gateway deposit failed";
    const isNoWallet = message.includes("No agent wallet");
    const isRateLimit =
      isRpcRateLimitError(err) || message.includes("rate-limited");
    const isInsufficient =
      message.includes("no USDC") || message.includes("Insufficient");

    return NextResponse.json(
      {
        error: isRateLimit ? ARC_RPC_RATE_LIMIT_MESSAGE : message,
      },
      {
        status: isNoWallet || isInsufficient ? 400 : isRateLimit ? 503 : 500,
      },
    );
  }
}
