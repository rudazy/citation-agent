import { splitRoyalty } from "@/lib/citations";
import { getAdminClient } from "@/lib/supabase/admin";

export async function recordCitationRoyalty(params: {
  citationId: string;
  creatorName: string;
  creatorWallet: string;
  payer: string;
  grossUsdc: string;
  gatewayTx: string | null;
  query?: string;
  paymentMemo?: string | null;
}) {
  const supabase = getAdminClient();
  if (!supabase) {
    console.warn("[royalties] Supabase not configured; skipping royalty record");
    return;
  }

  const { creatorAmount, platformAmount } = splitRoyalty(params.grossUsdc);

  const { error: earningsError } = await supabase.from("creator_earnings").insert({
    citation_id: params.citationId,
    creator_name: params.creatorName,
    creator_wallet: params.creatorWallet,
    payer: params.payer,
    gross_usdc: params.grossUsdc,
    royalty_usdc: creatorAmount,
    platform_usdc: platformAmount,
    gateway_tx: params.gatewayTx,
    query: params.query ?? null,
    payment_memo: params.paymentMemo ?? null,
  });

  if (earningsError) {
    console.error("[royalties] Failed to record creator earnings:", earningsError.message);
  }

  const { data: existing, error: fetchError } = await supabase
    .from("agent_reputation")
    .select("total_spent_usdc, citation_count")
    .eq("payer", params.payer)
    .maybeSingle();

  if (fetchError) {
    console.error("[royalties] Failed to fetch agent reputation:", fetchError.message);
    return;
  }

  const nextTotal =
    Number(existing?.total_spent_usdc ?? 0) + parseFloat(params.grossUsdc);
  const nextCount = (existing?.citation_count ?? 0) + 1;

  const { error: upsertError } = await supabase.from("agent_reputation").upsert({
    payer: params.payer,
    total_spent_usdc: nextTotal,
    citation_count: nextCount,
    last_payment_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    console.error("[royalties] Failed to update agent reputation:", upsertError.message);
  }
}