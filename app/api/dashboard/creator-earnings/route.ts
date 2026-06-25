import { NextResponse } from "next/server";
import { fetchCreatorEarningsForOperator } from "@/lib/dashboard-ledger";
import { verifyOperatorRequest } from "@/lib/operator";

/** Operator-only creator royalty ledger (no public Supabase read). */
export async function GET(request: Request) {
  if (!(await verifyOperatorRequest(request))) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  const { data, error } = await fetchCreatorEarningsForOperator();
  if (error) {
    return NextResponse.json({ error }, { status: error === "Supabase not configured" ? 503 : 500 });
  }

  return NextResponse.json(
    { earnings: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}