import { NextResponse, type NextRequest } from "next/server";
import { getAddress } from "viem";
import { provisionAgentWalletForSession } from "@/lib/agent-wallet";
import {
  getProfileByWallet,
  getUsernameChangeStatus,
  linkPublisherToAgentProfile,
  resolveProfileForWallets,
  setUsername,
} from "@/lib/platform-profile";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { formatUsernameDisplay } from "@/lib/username";
import { getUserAgentWallet } from "@/lib/user-agent-wallet";
import { ensureAgentSession } from "@/lib/agent-session";

function parsePublisherAddress(raw: string | null): `0x${string}` | null {
  if (!raw?.trim()) return null;
  try {
    return getAddress(raw.trim());
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sessionId = await ensureAgentSession();
  const agent = await resolveUserAgent();
  const publisherParam = parsePublisherAddress(
    req.nextUrl.searchParams.get("publisher"),
  );

  let linkedPublisher: `0x${string}` | null = null;
  const stored = await getUserAgentWallet(sessionId);
  if (stored?.linkedWallet) {
    linkedPublisher = stored.linkedWallet;
  }

  const publisher = publisherParam ?? linkedPublisher;
  const wallets = [
    ...(agent ? [agent.address] : []),
    ...(publisher ? [publisher] : []),
  ];

  const profile = wallets.length > 0 ? await resolveProfileForWallets(wallets) : null;

  if (!profile) {
    return NextResponse.json({
      hasProfile: false,
      username: null,
      displayName: null,
      canChangeUsername: true,
      nextChangeAt: null,
      agentConfigured: Boolean(agent),
    });
  }

  const change = getUsernameChangeStatus(profile);
  return NextResponse.json({
    hasProfile: true,
    username: profile.username,
    displayName: formatUsernameDisplay(profile.username),
    canChangeUsername: change.canChange,
    nextChangeAt: change.nextChangeAt,
    agentConfigured: Boolean(agent),
  });
}

export async function POST(req: NextRequest) {
  let body: { username?: string; publisherAddress?: string };
  try {
    body = (await req.json()) as { username?: string; publisherAddress?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  if (!username.trim()) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
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

  const publisherAddress = parsePublisherAddress(
    typeof body.publisherAddress === "string" ? body.publisherAddress : null,
  );

  const rate = checkRateLimit(agent.address, {
    namespace: "profile-username",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many username requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const result = await setUsername({
    username,
    agentAddress: agent.address,
    publisherAddress,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (publisherAddress) {
    await linkPublisherToAgentProfile(agent.address, publisherAddress);
  }

  const change = getUsernameChangeStatus(result.profile);
  return NextResponse.json({
    username: result.profile.username,
    displayName: formatUsernameDisplay(result.profile.username),
    canChangeUsername: change.canChange,
    nextChangeAt: change.nextChangeAt,
  });
}

export async function PUT(req: NextRequest) {
  return POST(req);
}