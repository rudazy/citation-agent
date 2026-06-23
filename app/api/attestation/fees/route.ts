import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyOperatorRequest } from "@/lib/operator";

/**
 * GET : operator-only platform-fee ledger + total. Reads via the service-role
 * admin client (bypasses RLS); the table itself denies anon access. Returns 403
 * to any caller that is not the verified operator.
 */
export async function GET(request: Request) {
  if (!(await verifyOperatorRequest(request))) {
    return NextResponse.json({ error: "Operator only" }, { status: 403 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("attestation_platform_fees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fees = data ?? [];
  const totalUsdc = fees.reduce(
    (sum, row) => sum + parseFloat((row.platform_fee_usdc as string) || "0"),
    0,
  );

  return NextResponse.json(
    { fees, totalUsdc },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
