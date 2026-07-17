import { NextResponse } from "next/server";
import { ensureAgentSession } from "@/lib/agent-session";
import { getPublishedPostById } from "@/lib/creator-posts";
import { recordPostView } from "@/lib/post-views";
import { checkRateLimit } from "@/lib/rate-limit";

/** Fire-and-forget view beacon from report pages. Dedupe is per viewer per day. */
export async function POST(request: Request) {
  let postId = "";
  let referrer: string | null = null;
  try {
    const body = (await request.json()) as { postId?: string; referrer?: string };
    postId = String(body.postId ?? "").trim();
    referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!postId || postId.length > 120) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const sessionId = await ensureAgentSession();
  const rate = checkRateLimit(sessionId, {
    namespace: "post-view",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ ok: true });
  }

  // Only count views of real, live posts — garbage ids never hit the table.
  const post = await getPublishedPostById(postId);
  if (!post) return NextResponse.json({ ok: true });

  await recordPostView({ postId, sessionId, referrer });
  return NextResponse.json({ ok: true });
}
