import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getProfileByUsername } from "@/lib/platform-profile";
import {
  REFERRAL_COOKIE,
  REFERRAL_TTL_SECONDS,
  normalizeReferralCode,
} from "@/lib/referral";

/**
 * Referral capture. A landing page posts the `?ref=` code it arrived with; the
 * code is validated against a real profile and stored in an httpOnly cookie so
 * a page reload or a later visit still credits the curator.
 *
 * The cookie is httpOnly, so the catalog reads it back through GET rather than
 * from document.cookie, then carries it on the unlock request as a query param
 * (the agent unlock path proxies server-side, where cookies do not propagate).
 */

async function readStoredReferral(): Promise<string | null> {
  const store = await cookies();
  return normalizeReferralCode(store.get(REFERRAL_COOKIE)?.value);
}

export async function GET() {
  return NextResponse.json({ ref: await readStoredReferral() });
}

export async function POST(request: Request) {
  let body: { ref?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ref = normalizeReferralCode(body.ref);
  if (!ref) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
  }

  // Only store codes that map to a real desk, so junk never reaches the ledger.
  const curator = await getProfileByUsername(ref);
  if (!curator) {
    return NextResponse.json({ ref: null, stored: false });
  }

  const store = await cookies();
  store.set(REFERRAL_COOKIE, curator.username, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFERRAL_TTL_SECONDS,
  });

  return NextResponse.json({ ref: curator.username, stored: true });
}

/** Clear a stored referral (used when a curator lands on their own link). */
export async function DELETE() {
  const store = await cookies();
  store.delete(REFERRAL_COOKIE);
  return NextResponse.json({ ref: null });
}
