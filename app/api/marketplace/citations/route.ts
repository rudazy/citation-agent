import { NextRequest, NextResponse } from "next/server";
import { getCreatorContentById, loadAllCreatorContent } from "@/lib/citations";
import { recordCitationRoyalty } from "@/lib/royalties";
import { withGateway } from "@/lib/x402";

const paidHandler = async (
  req: NextRequest,
  ctx: { payer: string; gatewayTx: string | null },
) => {
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

  await recordCitationRoyalty({
    citationId: content.id,
    creatorName: content.author,
    creatorWallet: content.authorWallet,
    payer: ctx.payer,
    grossUsdc: content.priceUsdc,
    gatewayTx: ctx.gatewayTx,
    query,
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
    timestamp: new Date().toISOString(),
  });
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    const items = loadAllCreatorContent().map((item) => ({
      id: item.id,
      title: item.title,
      author: item.author,
      price_usdc: item.priceUsdc,
      tags: item.tags,
      excerpt: item.excerpt,
      endpoint: `/api/marketplace/citations?id=${item.id}`,
      token: process.env.CANTEEN_USDC_ADDRESS ? "cUSDC" : "USDC",
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