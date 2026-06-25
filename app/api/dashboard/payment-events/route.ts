import { NextResponse } from "next/server";
import { fetchPaymentEventsForOperator } from "@/lib/dashboard-ledger";
import { verifyOperatorRequest } from "@/lib/operator";

/** Operator-only payment event ledger (no public Supabase read). */
export async function GET(request: Request) {
  if (!(await verifyOperatorRequest(request))) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  const { data, error } = await fetchPaymentEventsForOperator();
  if (error) {
    return NextResponse.json({ error }, { status: error === "Supabase not configured" ? 503 : 500 });
  }

  return NextResponse.json(
    { events: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}