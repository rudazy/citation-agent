import { NextResponse, type NextRequest } from "next/server";
import {
  deleteDraft,
  listDraftsForWallet,
  upsertDraft,
} from "@/lib/creator-drafts";
import { requirePublisherUsername } from "@/lib/platform-profile";
import { verifyMyPostsRequestReadOnly } from "@/lib/publisher-auth";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET — list drafts for the signed publisher wallet.
 * Auth: x-my-posts-* headers (read-only signature, reusable within window).
 */
export async function GET(request: Request) {
  const wallet = await verifyMyPostsRequestReadOnly(request);
  if (!wallet) {
    return NextResponse.json(
      { error: "Connect your wallet and sign to view drafts" },
      { status: 401 },
    );
  }

  const drafts = await listDraftsForWallet(wallet);
  return NextResponse.json({
    count: drafts.length,
    drafts: drafts.map((d) => ({
      id: d.id,
      title: d.title,
      subheading: d.subheading,
      body: d.body,
      price_usdc: d.priceUsdc,
      tags: d.tags,
      author_name: d.authorName,
      payout_wallet: d.payoutWallet,
      updated_at: d.updatedAt,
      created_at: d.createdAt,
    })),
  });
}

/**
 * POST — create or update a draft (body.id optional for update).
 * Auth: x-my-posts-* headers. Username required on publisher profile.
 */
export async function POST(request: NextRequest) {
  const wallet = await verifyMyPostsRequestReadOnly(request);
  if (!wallet) {
    return NextResponse.json(
      { error: "Connect your wallet and sign to save a draft" },
      { status: 401 },
    );
  }

  const rate = checkRateLimit(wallet, {
    namespace: "save-draft",
    limit: 40,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many draft saves. Please wait." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: {
    id?: string;
    title?: string;
    subheading?: string;
    body?: string;
    price_usdc?: string;
    tags?: string[];
    payout_wallet?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const usernameResult = await requirePublisherUsername(wallet);
  if (!usernameResult.ok) {
    return NextResponse.json(
      { error: usernameResult.error },
      { status: usernameResult.status },
    );
  }

  const result = await upsertDraft({
    id: typeof body.id === "string" ? body.id : undefined,
    title: body.title,
    subheading: body.subheading,
    body: body.body,
    priceUsdc: body.price_usdc,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    payoutWallet: body.payout_wallet,
    username: usernameResult.profile.username,
    connectedWallet: wallet,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    draft: {
      id: result.draft.id,
      title: result.draft.title,
      subheading: result.draft.subheading,
      body: result.draft.body,
      price_usdc: result.draft.priceUsdc,
      tags: result.draft.tags,
      author_name: result.draft.authorName,
      payout_wallet: result.draft.payoutWallet,
      updated_at: result.draft.updatedAt,
      created_at: result.draft.createdAt,
    },
  });
}

/**
 * DELETE — remove a draft by id (?id=).
 */
export async function DELETE(request: NextRequest) {
  const wallet = await verifyMyPostsRequestReadOnly(request);
  if (!wallet) {
    return NextResponse.json(
      { error: "Connect your wallet and sign to delete a draft" },
      { status: 401 },
    );
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Draft id is required" }, { status: 400 });
  }

  const result = await deleteDraft(id, wallet);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
