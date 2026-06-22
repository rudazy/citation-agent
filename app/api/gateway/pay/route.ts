import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedPayPath, payWithAgentGateway } from "@/lib/agent-gateway";

const bodySchema = z.object({
  path: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
  memo: z.string().max(120).optional(),
  body: z.unknown().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isAllowedPayPath(body.path)) {
    return NextResponse.json({ error: "Payment path not allowed" }, { status: 400 });
  }

  try {
    const result = await payWithAgentGateway({
      path: body.path,
      method: body.method,
      memo: body.memo,
      body: body.body,
    });

    return NextResponse.json({
      data: result.data,
      formattedAmount: result.formattedAmount,
      settlementId: result.transaction ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent payment failed" },
      { status: 500 },
    );
  }
}