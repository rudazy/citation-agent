import { NextRequest, NextResponse } from "next/server";
import { getCreatorContentById, loadAllCreatorContent } from "@/lib/citations";
import { recordCitationRoyalty } from "@/lib/royalties";
import { formatCitationPaymentMemo } from "@/lib/payment-memo";
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

  const content = getCreatorContentById(id);
  if (!content) {
    return NextResponse.json({ error: `Citation not found: ${id}` }, { status: 404 });
  }

  const paymentMemo =
    ctx.paymentMemo ?? formatCitationPaymentMemo(content.id, content.author);

  await recordCitationRoyalty({
    citationId: content.id,
    creatorName: content.author,
    creatorWallet: content.authorWallet,
    payer: ctx.payer,
    grossUsdc: content.priceUsdc,
    gatewayTx: ctx.gatewayTx,
    query,
    paymentMemo,
  });

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
      author_wallet: content.authorWallet,
      price_usdc: content.priceUsdc,
      tags: content.tags,
      body: content.body,
      royalty_split: {
        creator_share: "70%",
        platform_share: "30%",
      },
    },
    attribution:
      "Paid marketplace citation — royalty recorded for creator wallet at settlement time.",
    payment_memo: paymentMemo,
    arc_memo_contract: "0x5294E9927c3306DcBaDb03fe70b92e01cCede505",
    timestamp: new Date().toISOString(),
  });
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    const content = loadAllCreatorContent();
    // Enrich each listing with its author's TrustGate score server side, in one
    // deduped pass. Degrades to null (rendered as nothing) when the API is unset.
    const scores = await getTrustScores(content.map((item) => item.authorWallet));

    const items = content.map((item) => ({
      id: item.id,
      title: item.title,
      author: item.author,
      author_wallet: item.authorWallet,
      price_usdc: item.priceUsdc,
      tags: item.tags,
      excerpt: item.excerpt,
      endpoint: `/api/marketplace/citations?id=${item.id}`,
      token: process.env.CANTEEN_USDC_ADDRESS ? "cUSDC" : "USDC",
      trust: scores.get(item.authorWallet.toLowerCase()) ?? null,
    }));

    return NextResponse.json({
      marketplace: "citation-agent",
      count: items.length,
      listings: items,
      purchase_endpoint: "/api/marketplace/citations?id=<listing-id>",
    });
  }

  const content = getCreatorContentById(id);
  const price = content ? `$${content.priceUsdc}` : "$0.001";

  return withGateway(paidHandler, price, "/api/marketplace/citations")(req);
}