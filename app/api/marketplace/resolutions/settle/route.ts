import { NextResponse } from "next/server";
import { getPublishedPostById } from "@/lib/creator-posts";
import { verifyOperatorRequest } from "@/lib/operator";
import { recordSettlement } from "@/lib/signal-resolution-store";
import { serializeResolution } from "@/lib/signal-resolution-view";

/**
 * Record the on-chain settlement of a disputed stake.
 *
 * Deliberately separate from `adjudicate`: recording the verdict must never
 * depend on a wallet round-trip, and a failed transaction must not be able to
 * roll back a verdict that already stands.
 *
 * The direction (release vs slash) and the beneficiary are both derived from the
 * adjudication and read back off the chain — the request body supplies only a tx
 * hash, so the caller cannot choose to refund a challenger who lost.
 */
export async function POST(request: Request) {
  if (!(await verifyOperatorRequest(request))) {
    return NextResponse.json({ error: "Operator signature required" }, { status: 401 });
  }

  let body: { postId?: string; txHash?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }
  if (!txHash) {
    return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
  }

  const result = await recordSettlement({ postId, txHash });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const post = await getPublishedPostById(postId);
  return NextResponse.json({
    resolution: serializeResolution(postId, result.resolution, post),
  });
}
