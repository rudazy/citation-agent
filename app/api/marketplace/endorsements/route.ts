import { NextResponse, type NextRequest } from "next/server";
import { requireAgentProfile } from "@/lib/agent-profile-auth";
import { getCreatorContentById } from "@/lib/citations";
import {
  addEndorsement,
  listEndorsementsForPost,
  removeEndorsement,
} from "@/lib/endorsements";
import { createNotification } from "@/lib/notifications";
import { getProfileByUsername } from "@/lib/platform-profile";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildProfilePath } from "@/lib/profile-url";
import { withReferral } from "@/lib/referral";
import { buildPostSharePath } from "@/lib/post-share-url";

const USERNAME_REQUIRED = "Choose a username before endorsing";

function readPostId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const postId = readPostId(req.nextUrl.searchParams.get("postId"));
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const endorsements = await listEndorsementsForPost(postId);
  return NextResponse.json({
    postId,
    count: endorsements.length,
    endorsements: endorsements.map((row) => ({
      username: row.endorserUsername,
      note: row.note,
      created_at: row.createdAt,
      profile_path: buildProfilePath(row.endorserUsername),
    })),
  });
}

export async function POST(req: NextRequest) {
  let body: { postId?: string; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = readPostId(body.postId);
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const resolved = await requireAgentProfile({
    usernameRequiredMessage: USERNAME_REQUIRED,
  });
  if (!resolved.ok) return resolved.response;

  // A stamp is a public reputation claim; 20/min is far above human cadence.
  const rate = checkRateLimit(resolved.agent.address, {
    namespace: "post-endorse",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many endorsements. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const post = await getCreatorContentById(postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const result = await addEndorsement({
    postId,
    endorserProfileId: resolved.profile.id,
    endorserUsername: resolved.profile.username,
    authorUsername: post.author,
    note: body.note,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Best-effort author notification; never fails the stamp itself.
  try {
    const author = await getProfileByUsername(post.author);
    if (author && author.id !== resolved.profile.id) {
      await createNotification({
        profileId: author.id,
        type: "endorsement",
        actorUsername: resolved.profile.username,
        postId,
      });
    }
  } catch (err) {
    console.warn("[endorsements] author notification failed:", err);
  }

  return NextResponse.json(
    {
      endorsed: true,
      postId,
      username: resolved.profile.username,
      // Sharing through this path is what converts a stamp into curator credit.
      share_path: withReferral(
        buildPostSharePath(postId),
        resolved.profile.username,
      ),
    },
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  const postId = readPostId(req.nextUrl.searchParams.get("postId"));
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const resolved = await requireAgentProfile({
    usernameRequiredMessage: USERNAME_REQUIRED,
  });
  if (!resolved.ok) return resolved.response;

  const result = await removeEndorsement({
    postId,
    endorserProfileId: resolved.profile.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ endorsed: false, postId });
}
