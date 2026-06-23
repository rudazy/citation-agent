import { NextRequest, NextResponse } from "next/server";
import { getCreatorContentById, loadAllCreatorContent } from "@/lib/citations";
import { incrementPostPaidCount, insertPublishedPost } from "@/lib/creator-posts";
import { recordCitationRoyalty } from "@/lib/royalties";
import { formatCitationPaymentMemo } from "@/lib/payment-memo";
import { verifyPublishRequest } from "@/lib/publish-auth";
import { isPaidTrustLookupAvailable, trustScoreToSignal } from "@/lib/creator-trust";
import { getTrustScores } from "@/lib/trustgate";
import { withGateway, type GatewayContext } from "@/lib/x402";

const paidHandler = async (req: NextRequest, ctx: GatewayContext) => {
  const id = req.nextUrl.searchParams.get("id");
  const query = req.nextUrl.searchParams.get("query") ?? undefined;

  if (!id) {
    return NextResponse.json(
      { error: "Missing citation id. Use ?id=<citation-id>" },
      { status: 400 },
    );
  }

  const content = await getCreatorContentById(id);
  if (!content) {
    return NextResponse.json({ error: `Citation not found: ${id}` }, { status: 404 });
  }

  const paymentMemo =
    ctx.paymentMemo ?? formatCitationPaymentMemo(content.id, content.author);

  await recordCitationRoyalty({
    citationId: content.id,
    creatorName: content.author,
    creatorWallet: content.payoutWallet,
    payer: ctx.payer,
    grossUsdc: content.priceUsdc,
    gatewayTx: ctx.gatewayTx,
    query,
    paymentMemo,
  });

  if (content.source === "database") {
    await incrementPostPaidCount(content.id);
  }

  const canteenAddress = process.env.CANTEEN_USDC_ADDRESS ?? null;

  return NextResponse.json({
    marketplace: {
      listing_id: content.id,
      token: canteenAddress ? "cUSDC" : "USDC",
      canteen_usdc_address: canteenAddress,
    },
    citation: {
      id: content.id,
      title: content.title,
      author: content.author,
      price_usdc: content.priceUsdc,
      tags: content.tags,
      subheading: content.subheading,
      body: content.body,
      royalty_split: {
        creator_share: "70%",
        platform_share: "30%",
      },
    },
    attribution:
      "Paid marketplace citation — royalty recorded for creator payout wallet at settlement time.",
    payment_memo: paymentMemo,
    arc_memo_contract: "0x5294E9927c3306DcBaDb03fe70b92e01cCede505",
    timestamp: new Date().toISOString(),
  });
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    const content = await loadAllCreatorContent();
    const scores = await getTrustScores(
      content.map((item) => item.connectedWallet),
    );

    const paidTrustAvailable = isPaidTrustLookupAvailable();

    const items = content.map((item) => ({
      id: item.id,
      title: item.title,
      author: item.author,
      price_usdc: item.priceUsdc,
      tags: item.tags,
      subheading: item.subheading,
      paid_count: item.paidCount,
      endpoint: `/api/marketplace/citations?id=${item.id}`,
      token: process.env.CANTEEN_USDC_ADDRESS ? "cUSDC" : "USDC",
      trust: trustScoreToSignal(scores.get(item.connectedWallet.toLowerCase()) ?? null, "free"),
      trust_paid_lookup: paidTrustAvailable,
    }));

    return NextResponse.json({
      marketplace: "citation-agent",
      count: items.length,
      listings: items,
      purchase_endpoint: "/api/marketplace/citations?id=<listing-id>",
      trust_lookup_endpoint: "/api/trustgate/score?postId=<listing-id>",
    });
  }

  const content = await getCreatorContentById(id);
  const price = content ? `$${content.priceUsdc}` : "$0.001";

  return withGateway(paidHandler, price, "/api/marketplace/citations")(req);
}

export async function POST(req: NextRequest) {
  const connectedWallet = await verifyPublishRequest(req);
  if (!connectedWallet) {
    return NextResponse.json(
      { error: "Connect your wallet and sign to publish" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tagsRaw = body.tags;
  const tags =
    Array.isArray(tagsRaw)
      ? tagsRaw.map((t) => String(t))
      : typeof tagsRaw === "string"
        ? tagsRaw.split(",").map((t) => t.trim())
        : undefined;

  const result = await insertPublishedPost({
    title: String(body.title ?? ""),
    subheading: String(body.subheading ?? ""),
    body: String(body.body ?? ""),
    priceUsdc: String(body.price_usdc ?? body.priceUsdc ?? ""),
    tags,
    authorName:
      typeof body.author_name === "string"
        ? body.author_name
        : typeof body.authorName === "string"
          ? body.authorName
          : undefined,
    payoutWallet:
      typeof body.payout_wallet === "string"
        ? body.payout_wallet
        : typeof body.payoutWallet === "string"
          ? body.payoutWallet
          : undefined,
    connectedWallet,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      post: {
        id: result.post.id,
        title: result.post.title,
        subheading: result.post.subheading,
        price_usdc: result.post.price_usdc,
        paid_count: result.post.paid_count,
        author: result.post.author_name,
        tags: result.post.tags,
        endpoint: `/api/marketplace/citations?id=${result.post.id}`,
      },
    },
    { status: 201 },
  );
}