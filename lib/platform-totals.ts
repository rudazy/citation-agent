import { getAdminClient } from "@/lib/supabase/admin";
import { formatUsdc } from "@/lib/marketplace-metrics";

export type PlatformTotals = {
  payments: number;
  royalties: number;
  agents: number;
  totalVolumeUsdc: string;
  paidToCreatorsUsdc: string;
};

const EMPTY_TOTALS: PlatformTotals = {
  payments: 0,
  royalties: 0,
  agents: 0,
  totalVolumeUsdc: "0",
  paidToCreatorsUsdc: "0",
};

/** Sum numeric USDC strings; ignores non-finite values. */
export function sumUsdcAmounts(amounts: string[]): number {
  let total = 0;
  for (const raw of amounts) {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * Platform-wide aggregate totals computed server-side via the service-role admin
 * client. Returns counts and sums only — never rows, never payer wallets.
 */
export async function computePlatformTotals(): Promise<PlatformTotals> {
  const supabase = getAdminClient();
  if (!supabase) return { ...EMPTY_TOTALS };

  const [paymentsCount, royaltiesCount, agentsCount, paymentAmounts, royaltyAmounts] =
    await Promise.all([
      supabase
        .from("payment_events")
        .select("*", { count: "exact", head: true })
        .then((r) => ({ count: r.count ?? 0, error: r.error })),
      supabase
        .from("creator_earnings")
        .select("*", { count: "exact", head: true })
        .then((r) => ({ count: r.count ?? 0, error: r.error })),
      supabase
        .from("agent_reputation")
        .select("*", { count: "exact", head: true })
        .then((r) => ({ count: r.count ?? 0, error: r.error })),
      supabase
        .from("payment_events")
        .select("amount_usdc")
        .then((r) => ({ data: r.data ?? [], error: r.error })),
      supabase
        .from("creator_earnings")
        .select("royalty_usdc")
        .then((r) => ({ data: r.data ?? [], error: r.error })),
    ]);

  for (const result of [
    paymentsCount,
    royaltiesCount,
    agentsCount,
    paymentAmounts,
    royaltyAmounts,
  ]) {
    if ("error" in result && result.error) {
      console.error("[platform-totals] query failed:", result.error.message);
      return { ...EMPTY_TOTALS };
    }
  }

  const volume = sumUsdcAmounts(
    (paymentAmounts.data as { amount_usdc: string }[]).map((r) => r.amount_usdc),
  );
  const paid = sumUsdcAmounts(
    (royaltyAmounts.data as { royalty_usdc: string }[]).map((r) => r.royalty_usdc),
  );

  return {
    payments: paymentsCount.count,
    royalties: royaltiesCount.count,
    agents: agentsCount.count,
    totalVolumeUsdc: formatUsdc(volume),
    paidToCreatorsUsdc: formatUsdc(paid),
  };
}