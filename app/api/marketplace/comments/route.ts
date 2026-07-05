import { NextResponse, type NextRequest } from "next/server";
import { provisionAgentWalletForSession } from "@/lib/agent-wallet";
import { resolveProfileForWallets, setUsername } from "@/lib/platform-profile";
import { addComment, listCommentsForPost } from "@/lib/post-comments";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUserAgent } from "@/lib/resolve-user-agent";

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId")?.trim();
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const comments = await listCommentsForPost(postId);
  return NextResponse.json({ postId, count: comments.length, comments });
}

export async function POST(req: NextRequest) {
  let body: { postId?: string; body?: string; username?: string; parentId?: string };
  try {
    body = (await req.json()) as {
      postId?: string;
      body?: string;
      username?: string;
      parentId?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  let agent = await resolveUserAgent();
  if (!agent) {
    try {
      await provisionAgentWalletForSession();
      agent = await resolveUserAgent();
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to create agent wallet",
        },
        { status: 500 },
      );
    }
  }

  if (!agent) {
    return NextResponse.json({ error: "Agent wallet unavailable" }, { status: 503 });
  }

  const rate = checkRateLimit(agent.address, {
    namespace: "post-comment",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many comments. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let profile = await resolveProfileForWallets([agent.address]);

  if (!profile) {
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username) {
      return NextResponse.json(
        { error: "Choose a username before commenting", code: "USERNAME_REQUIRED" },
        { status: 403 },
      );
    }

    const usernameResult = await setUsername({
      username,
      agentAddress: agent.address,
    });
    if (!usernameResult.ok) {
      return NextResponse.json(
        { error: usernameResult.error },
        { status: usernameResult.status },
      );
    }
    profile = usernameResult.profile;
  }

  const parentId =
    typeof body.parentId === "string" && body.parentId.trim()
      ? body.parentId.trim()
      : null;

  const result = await addComment({
    postId,
    profile,
    agentAddress: agent.address,
    body: text,
    parentId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ comment: result.comment }, { status: 201 });
}