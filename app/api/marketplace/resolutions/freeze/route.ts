import { NextResponse } from "next/server";
import { getPublishedPostById } from "@/lib/creator-posts";
import { verifyOperatorRequest } from "@/lib/operator";
import { recordStakeFreeze } from "@/lib/signal-resolution-store";
import { serializeResolution } from "@/lib/signal-resolution-view";

/**
 * Record that the operator froze a disputed stake on-chain.
 *
 * There is no server-side arbiter key by design — the operator signs the
 * transaction in their own wallet and posts the hash here. The tx is verified
 * against the contract before anything is written, so this endpoint records
 * chain state rather than trusting the caller.
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

  const result = await recordStakeFreeze({ postId, txHash });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const post = await getPublishedPostById(postId);
  return NextResponse.json({
    resolution: serializeResolution(postId, result.resolution, post),
  });
}
