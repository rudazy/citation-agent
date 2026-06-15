import { NextRequest, NextResponse } from "next/server";
import { getCreatorContentById } from "@/lib/citations";
import { recordCitationRoyalty } from "@/lib/royalties";
import { withGateway } from "@/lib/x402";

const handler = async (req: NextRequest, ctx: { payer: string; gatewayTx: string | null }) => {
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

  return NextResponse.json({
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
      "Paid citation — royalty recorded for creator wallet at settlement time.",
    timestamp: new Date().toISOString(),
  });
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const content = id ? getCreatorContentById(id) : null;
  const price = content ? `$${content.priceUsdc}` : "$0.001";

  return withGateway(handler, price, "/api/premium/citation")(req);
}