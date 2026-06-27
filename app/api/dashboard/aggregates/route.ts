import { NextResponse } from "next/server";
import { computePlatformTotals } from "@/lib/platform-totals";

/**
 * Public platform aggregate totals. Computed server-side via the service-role
 * admin client; returns counts and sums only — never rows, never payer wallets.
 * No operator auth required.
 */
export async function GET() {
  try {
    const totals = await computePlatformTotals();
    return NextResponse.json(totals, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[dashboard/aggregates] failed:", err);
    return NextResponse.json({ error: "Failed to load aggregates" }, { status: 500 });
  }
}