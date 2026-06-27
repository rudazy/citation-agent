import { NextResponse } from "next/server";
import { computeMarketplaceMetrics } from "@/lib/marketplace-metrics";

/**
 * Public marketplace social-proof metrics. Returns only aggregated totals
 * (computed server-side via the service-role admin client); the raw financial
 * tables are never exposed to the anon key.
 */
export async function GET() {
  try {
    const metrics = await computeMarketplaceMetrics();
    return NextResponse.json(metrics, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[marketplace-metrics] failed:", err);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
