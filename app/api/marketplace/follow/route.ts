import { NextResponse, type NextRequest } from "next/server";
import {
  followCreator,
  listFollowedCreators,
  unfollowCreator,
} from "@/lib/creator-follows";
import { getProfileByWallet } from "@/lib/platform-profile";
import { provisionAgentWalletForSession } from "@/lib/agent-wallet";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatUsernameDisplay, normalizeUsernameInput } from "@/lib/username";
import { buildProfilePath } from "@/lib/profile-url";

type AgentProfileOk = {
  ok: true;
  agent: { address: `0x${string}` };
  profile: { id: string; username: string };
};

type AgentProfileErr = { ok: false; response: NextResponse };

async function requireAgentProfile(): Promise<AgentProfileOk | AgentProfileErr> {
  let agent = await resolveUserAgent();
  if (!agent) {
    try {
      await provisionAgentWalletForSession();
      agent = await resolveUserAgent();
    } catch (err) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Failed to create agent wallet",
          },
          { status: 500 },
        ),
      };
    }
  }
  if (!agent) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Agent wallet unavailable" },
        { status: 503 },
      ),
    };
  }

  const profile = await getProfileByWallet(agent.address);
  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Choose a username before following creators",
          code: "username_required",
        },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    agent: { address: agent.address },
    profile: { id: profile.id, username: profile.username },
  };
}

export async function GET() {
  const resolved = await requireAgentProfile();
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

  const resolved = await requireAgentProfile();
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

  const resolved = await requireAgentProfile();
  if (!resolved.ok) return resolved.response;

  const result = await unfollowCreator(resolved.profile.id, username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ following: false, username });
}
