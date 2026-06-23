import { NextResponse } from "next/server";
import { loadAllCreatorContent } from "@/lib/citations";

export async function GET() {
  const content = await loadAllCreatorContent();
  const items = content.map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author,
    price_usdc: item.priceUsdc,
    tags: item.tags,
    subheading: item.subheading,
    paid_count: item.paidCount,
    endpoint: `/api/premium/citation?id=${item.id}`,
  }));

  return NextResponse.json({
    count: items.length,
    citations: items,
  });
}