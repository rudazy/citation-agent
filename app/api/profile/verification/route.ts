import { NextResponse } from "next/server";
import {
  getVerificationsForProfile,
  isVerificationKind,
  runVerificationCheck,
  upsertVerificationRequest,
} from "@/lib/profile-verification";
import { getProfileByWallet } from "@/lib/platform-profile";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUserAgent } from "@/lib/resolve-user-agent";

async function requireProfileId(): Promise<
  { ok: true; profileId: string } | { ok: false; response: NextResponse }
> {
  const agent = await resolveUserAgent();
  const profile = agent ? await getProfileByWallet(agent.address) : null;
  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Choose a username before verifying links", code: "username_required" },
        { status: 400 },
      ),
    };
  }
  return { ok: true, profileId: profile.id };
}

export async function GET() {
  const auth = await requireProfileId();
  if (!auth.ok) return auth.response;

  const verifications = await getVerificationsForProfile(auth.profileId);
  return NextResponse.json({
    verifications: verifications.map((v) => ({
      kind: v.kind,
      url: v.url,
      code: v.code,
      verified: v.verifiedAt != null,
      verifiedAt: v.verifiedAt,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireProfileId();
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit(auth.profileId, {
    namespace: "profile-verification",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts. Wait a minute and retry." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: { action?: string; kind?: string; url?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isVerificationKind(body.kind)) {
    return NextResponse.json({ error: "Unknown verification kind" }, { status: 400 });
  }

  if (body.action === "request") {
    const url = String(body.url ?? "");
    const result = await upsertVerificationRequest({
      profileId: auth.profileId,
      kind: body.kind,
      url,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ code: result.code });
  }

  if (body.action === "verify") {
    const result = await runVerificationCheck({
      profileId: auth.profileId,
      kind: body.kind,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ verified: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
