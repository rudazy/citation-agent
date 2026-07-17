import { NextResponse } from "next/server";
import {
  getProfileByWallet,
  setProfileTipWallet,
} from "@/lib/platform-profile";
import { verifyMyPostsRequest } from "@/lib/publisher-auth";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST: set or clear the optional tip wallet override. Same wallet-signature
 * auth as payout changes. Body: { tipWallet: "0x..." } to set, or
 * { tipWallet: null } (or empty string) to clear back to the payout wallet.
 */
export async function POST(request: Request) {
  const wallet = await verifyMyPostsRequest(request);
  if (!wallet) {
    return NextResponse.json(
      { error: "Sign with your publishing wallet to change the tip wallet" },
      { status: 401 },
    );
  }

  const rate = checkRateLimit(wallet, {
    namespace: "tip-wallet",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many tip wallet changes. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let tipWallet: string | null = null;
  try {
    const body = (await request.json()) as { tipWallet?: string | null };
    tipWallet =
      typeof body.tipWallet === "string" && body.tipWallet.trim()
        ? body.tipWallet.trim()
        : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profile = await getProfileByWallet(wallet);
  if (!profile) {
    return NextResponse.json(
      { error: "Choose a username before setting a tip wallet" },
      { status: 400 },
    );
  }

  const result = await setProfileTipWallet({ profileId: profile.id, tipWallet });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ tipWallet: result.tipWallet });
}
