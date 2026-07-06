import { NextResponse, type NextRequest } from "next/server";
import { getAddress } from "viem";
import { provisionAgentWalletForSession } from "@/lib/agent-wallet";
import { resolveCitationViewerWallets } from "@/lib/citation-viewer-wallets";
import { resolveProfileForWallets, setUsername } from "@/lib/platform-profile";
import { addComment, listCommentsForPost } from "@/lib/post-comments";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUserAgent } from "@/lib/resolve-user-agent";

function parsePublisherAddress(raw: string | undefined): `0x${string}` | null {
  if (!raw?.trim()) return null;
  try {
    return getAddress(raw.trim());
  } catch {
    return null;
  }
}

function addWalletToSet(wallets: Set<string>, address: string | null | undefined): void {
  if (!address?.trim()) return;
  try {
    wallets.add(getAddress(address).toLowerCase());
  } catch {
    // ignore invalid addresses
  }
}

function uniqueIdentityWallets(wallets: Set<string>): `0x${string}`[] {
  const seen = new Set<string>();
  const result: `0x${string}`[] = [];
  for (const wallet of wallets) {
    try {
      const normalized = getAddress(wallet).toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(getAddress(wallet));
    } catch {
      continue;
    }
  }
  return result;
}

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId")?.trim();
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const comments = await listCommentsForPost(postId);
  return NextResponse.json({ postId, count: comments.length, comments });
}

export async function POST(req: NextRequest) {
  let body: {
    postId?: string;
    body?: string;
    username?: string;
    parentId?: string;
    publisherAddress?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const publisherFromBody = parsePublisherAddress(body.publisherAddress);
  const viewerWallets = await resolveCitationViewerWallets(req);
  if (publisherFromBody) {
    addWalletToSet(viewerWallets, publisherFromBody);
  }

  let agent = await resolveUserAgent();
  if (agent) {
    addWalletToSet(viewerWallets, agent.address);
  }

  if (viewerWallets.size === 0) {
    try {
      await provisionAgentWalletForSession();
      agent = await resolveUserAgent();
      if (agent) addWalletToSet(viewerWallets, agent.address);
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

  if (viewerWallets.size === 0) {
    return NextResponse.json(
      { error: "Connect a wallet or create an agent wallet to comment" },
      { status: 401 },
    );
  }

  const identityWallets = uniqueIdentityWallets(viewerWallets);
  const rateWallet =
    publisherFromBody ??
    identityWallets.find(
      (wallet) => !agent || wallet.toLowerCase() !== agent.address.toLowerCase(),
    ) ??
    identityWallets[0];

  const rate = checkRateLimit(rateWallet, {
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

  let profile = await resolveProfileForWallets(identityWallets);

  if (!profile) {
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!username) {
      return NextResponse.json(
        { error: "Choose a username before commenting", code: "USERNAME_REQUIRED" },
        { status: 403 },
      );
    }

    const primaryWallet =
      publisherFromBody ?? agent?.address ?? identityWallets[0] ?? rateWallet;

    const usernameResult = await setUsername({
      username,
      agentAddress: agent?.address ?? primaryWallet,
      publisherAddress: publisherFromBody ?? primaryWallet,
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
    viewerWallets,
    body: text,
    parentId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ comment: result.comment }, { status: 201 });
}