import { NextResponse, type NextRequest } from "next/server";
import { getPublishedPostById } from "@/lib/creator-posts";
import { getProfileByWallet } from "@/lib/platform-profile";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { recordDispute } from "@/lib/signal-resolution-store";
import { serializeResolution } from "@/lib/signal-resolution-view";

/**
 * Challenge a signal resolution with an on-chain USDC stake.
 *
 * The caller stakes against `resolution:{postId}` through the existing
 * attestation flow, then submits the tx hash here. No username is required —
 * the stake itself is the credential, and it is verified on Arc before the
 * dispute is accepted.
 */
export async function POST(req: NextRequest) {
  let body: { postId?: string; txHash?: string; reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  if (!postId || !txHash) {
    return NextResponse.json(
      { error: "postId and txHash are required" },
      { status: 400 },
    );
  }

  // Rate-limit on the session agent when present; disputes cost real USDC, so
  // this only guards against hammering the RPC verification path.
  const agent = await resolveUserAgent();
  if (agent) {
    const rate = checkRateLimit(agent.address, {
      namespace: "resolution-dispute",
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many dispute attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
  }

  const disputer = agent ? await getProfileByWallet(agent.address) : null;

  const result = await recordDispute({
    postId,
    txHash,
    disputerProfileId: disputer?.id ?? null,
    reason: body.reason,
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
