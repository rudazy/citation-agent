import { NextResponse } from "next/server";
import { getPublishedPostById } from "@/lib/creator-posts";
import { verifyOperatorRequest } from "@/lib/operator";
import { adjudicateResolution } from "@/lib/signal-resolution-store";
import { serializeResolution } from "@/lib/signal-resolution-view";

/**
 * Settle a disputed resolution. Operator-signed, matching the other operator
 * routes — the adjudicator fixes the outcome that stands, and "upheld" vs
 * "overturned" is derived by comparing it to the creator's original call.
 */
export async function POST(request: Request) {
  if (!(await verifyOperatorRequest(request))) {
    return NextResponse.json({ error: "Operator signature required" }, { status: 401 });
  }

  let body: { postId?: string; outcome?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const result = await adjudicateResolution({
    postId,
    outcome: body.outcome,
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const post = await getPublishedPostById(postId);
  return NextResponse.json({
    resolution: serializeResolution(postId, result.resolution, post),
  });
}
