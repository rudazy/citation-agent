import { NextRequest, NextResponse } from "next/server";
import {
  ARC_EXPLORER,
  GATEWAY_API,
  GATEWAY_WALLET,
  PINNED_BATCH_TX,
} from "@/lib/marketplace";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sr = await fetch(`${GATEWAY_API}/v1/x402/transfers/${id}`);
  if (!sr.ok) {
    return new NextResponse(await sr.text(), { status: sr.status });
  }

  const settlement = (await sr.json()) as { status: string; updatedAt: string };
  if (settlement.status !== "completed" && settlement.status !== "confirmed") {
    return NextResponse.json({ batchTx: null, status: settlement.status });
  }

  const pinned = PINNED_BATCH_TX[id];
  if (pinned) {
    return NextResponse.json({
      batchTx: pinned,
      status: settlement.status,
      explorerUrl: `${ARC_EXPLORER}/tx/${pinned}`,
    });
  }

  const tr = await fetch(
    `${ARC_EXPLORER}/api/v2/addresses/${GATEWAY_WALLET}/transactions?filter=to`,
  );
  const { items } = (await tr.json()) as {
    items: { hash: string; timestamp: string; method: string | null }[];
  };
  const updatedAt = new Date(settlement.updatedAt).getTime();
  const candidate = items.find(
    (t) =>
      t.method === "submitBatch" &&
      new Date(t.timestamp).getTime() <= updatedAt + 5_000,
  );

  return NextResponse.json({
    batchTx: candidate?.hash ?? null,
    status: settlement.status,
    explorerUrl: candidate ? `${ARC_EXPLORER}/tx/${candidate.hash}` : null,
  });
}