import { NextResponse, type NextRequest } from "next/server";
import {
  followCreator,
  listFollowedCreators,
  unfollowCreator,
} from "@/lib/creator-follows";
import { requireAgentProfile } from "@/lib/agent-profile-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatUsernameDisplay, normalizeUsernameInput } from "@/lib/username";
import { buildProfilePath } from "@/lib/profile-url";

const USERNAME_REQUIRED = "Choose a username before following creators";

export async function GET() {
  const resolved = await requireAgentProfile({
    usernameRequiredMessage: USERNAME_REQUIRED,
  });
  if (!resolved.ok) return resolved.response;

  const followed = await listFollowedCreators(resolved.profile.id);

  return NextResponse.json({
    count: followed.length,
    following: followed.map((p) => ({
      username: p.username,
      displayName: formatUsernameDisplay(p.username),
      profilePath: buildProfilePath(p.username),
    })),
  });
}

export async function POST(req: NextRequest) {
  let body: { username?: string };
  try {
    body = (await req.json()) as { username?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = normalizeUsernameInput(body.username ?? "");
  if (!username) {
    return NextResponse.json({ error: "Valid username is required" }, { status: 400 });
  }

  const resolved = await requireAgentProfile({
    usernameRequiredMessage: USERNAME_REQUIRED,
  });
  if (!resolved.ok) return resolved.response;

  const rate = checkRateLimit(resolved.agent.address, {
    namespace: "follow-creator",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many follow requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const result = await followCreator(resolved.profile.id, username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    following: true,
    username,
    displayName: formatUsernameDisplay(username),
  });
}

export async function DELETE(req: NextRequest) {
  const username = normalizeUsernameInput(
    req.nextUrl.searchParams.get("username") ?? "",
  );
  if (!username) {
    return NextResponse.json({ error: "Valid username is required" }, { status: 400 });
  }

  const resolved = await requireAgentProfile({
    usernameRequiredMessage: USERNAME_REQUIRED,
  });
  if (!resolved.ok) return resolved.response;

  const result = await unfollowCreator(resolved.profile.id, username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ following: false, username });
}
