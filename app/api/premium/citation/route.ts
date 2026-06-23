import { NextRequest, NextResponse } from "next/server";
import { getCreatorContentById } from "@/lib/citations";
import { incrementPostPaidCount } from "@/lib/creator-posts";
import { recordCitationRoyalty } from "@/lib/royalties";
import { formatCitationPaymentMemo } from "@/lib/payment-memo";
import { withGateway, type GatewayContext } from "@/lib/x402";

const handler = async (req: NextRequest, ctx: GatewayContext) => {
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

  return NextResponse.json({
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
      "Paid citation — royalty recorded for creator payout wallet at settlement time.",
    payment_memo: paymentMemo,
    timestamp: new Date().toISOString(),
  });
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const content = id ? await getCreatorContentById(id) : null;
  const price = content ? `$${content.priceUsdc}` : "$0.001";

  return withGateway(handler, price, "/api/premium/citation")(req);
}