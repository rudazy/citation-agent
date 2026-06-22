import { NextRequest, NextResponse } from "next/server";
import { getAgentWalletStatus } from "@/lib/agent-wallet";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSellerAddress } from "@/lib/payment-wallets";

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") ?? "agent";
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ withdrawals: [] });
  }

  let walletAddress: string | null = null;

  if (scope === "seller") {
    walletAddress = getSellerAddress();
    if (!walletAddress) {
      return NextResponse.json({ withdrawals: [] });
    }
  } else {
    const status = await getAgentWalletStatus();
    walletAddress = status.address;
    if (!walletAddress) {
      return NextResponse.json({ withdrawals: [] });
    }
  }

  const normalized = walletAddress.toLowerCase();
  let query = supabase
    .from("withdrawals")
    .select("*")
    .order("created_at", { ascending: false });

  if (scope === "seller") {
    query = query.or(
      `wallet_address.eq.${normalized},and(wallet_address.is.null,role.eq.seller)`,
    );
  } else {
    query = query.eq("wallet_address", normalized);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { withdrawals: data ?? [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}