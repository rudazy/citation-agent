import { NextResponse } from "next/server";
import { loadAllCreatorContent } from "@/lib/citations";

export async function GET() {
  const items = loadAllCreatorContent().map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author,
    price_usdc: item.priceUsdc,
    tags: item.tags,
    excerpt: item.excerpt,
    endpoint: `/api/premium/citation?id=${item.id}`,
  }));

  return NextResponse.json({
    count: items.length,
    citations: items,
  });
}