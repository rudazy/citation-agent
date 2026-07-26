import { NextResponse, type NextRequest } from "next/server";
import { requireAgentProfile } from "@/lib/agent-profile-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublishedPostById } from "@/lib/creator-posts";
import { getResolution, recordResolution } from "@/lib/signal-resolution-store";
import { serializeResolution } from "@/lib/signal-resolution-view";

const USERNAME_REQUIRED = "Choose a username before resolving signals";

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId")?.trim();
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const [resolution, post] = await Promise.all([
    getResolution(postId),
    getPublishedPostById(postId),
  ]);

  return NextResponse.json({
    resolution: serializeResolution(postId, resolution, post),
  });
}

/** File an outcome for your own signal. Immutable once written. */
export async function POST(req: NextRequest) {
  let body: { postId?: string; outcome?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const resolved = await requireAgentProfile({
    usernameRequiredMessage: USERNAME_REQUIRED,
  });
  if (!resolved.ok) return resolved.response;

  const rate = checkRateLimit(resolved.agent.address, {
    namespace: "signal-resolve",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many resolutions. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const result = await recordResolution({
    postId,
    resolverProfileId: resolved.profile.id,
    resolverUsername: resolved.profile.username,
    outcome: body.outcome,
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const post = await getPublishedPostById(postId);
  return NextResponse.json(
    { resolution: serializeResolution(postId, result.resolution, post) },
    { status: 201 },
  );
}
