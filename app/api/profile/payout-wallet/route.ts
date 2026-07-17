import { NextResponse } from "next/server";
import {
  getProfileByWallet,
  setProfilePayoutWallet,
} from "@/lib/platform-profile";
import { verifyMyPostsRequest } from "@/lib/publisher-auth";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST: change the profile's payout wallet. Requires the same wallet-signature
 * auth as my-posts, so only the publishing wallet's owner can redirect payouts.
 * Applies to future publishes and tips; existing posts are untouched.
 */
export async function POST(request: Request) {
  const wallet = await verifyMyPostsRequest(request);
  if (!wallet) {
    return NextResponse.json(
      { error: "Sign with your publishing wallet to change the payout wallet" },
      { status: 401 },
    );
  }

  const rate = checkRateLimit(wallet, {
    namespace: "payout-wallet",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many payout changes. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let payoutWallet = "";
  try {
    const body = (await request.json()) as { payoutWallet?: string };
    payoutWallet = String(body.payoutWallet ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payoutWallet) {
    return NextResponse.json({ error: "Payout wallet is required" }, { status: 400 });
  }

  const profile = await getProfileByWallet(wallet);
  if (!profile) {
    return NextResponse.json(
      { error: "Choose a username before setting a payout wallet" },
      { status: 400 },
    );
  }

  const result = await setProfilePayoutWallet({
    profileId: profile.id,
    payoutWallet,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ payoutWallet: result.payoutWallet });
}
