import { getAdminClient } from "@/lib/supabase/admin";

export type PaymentEventInsert = {
  endpoint: string;
  payer: string;
  amount_usdc: string;
  network: string;
  gateway_tx: string | null;
  payment_memo?: string | null;
  raw?: Record<string, unknown> | null;
};

/**
 * Persists a settled x402 payment to Supabase. Returns false when the admin
 * client is missing or every insert attempt fails (logged server-side).
 */
export async function recordPaymentEvent(
  event: PaymentEventInsert,
): Promise<boolean> {
  const supabase = getAdminClient();
  if (!supabase) {
    console.error(
      "[payment-events] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing — payment settled on-chain but not saved to dashboard.",
    );
    return false;
  }

  const attempts: Array<Record<string, unknown>> = [
    {
      endpoint: event.endpoint,
      payer: event.payer,
      amount_usdc: event.amount_usdc,
      network: event.network,
      gateway_tx: event.gateway_tx,
      payment_memo: event.payment_memo ?? null,
      raw: event.raw ?? null,
    },
    {
      endpoint: event.endpoint,
      payer: event.payer,
      amount_usdc: event.amount_usdc,
      network: event.network,
      gateway_tx: event.gateway_tx,
      raw: event.raw ?? null,
    },
    {
      endpoint: event.endpoint,
      payer: event.payer,
      amount_usdc: event.amount_usdc,
      network: event.network,
      gateway_tx: event.gateway_tx,
    },
  ];

  for (const row of attempts) {
    const { error } = await supabase.from("payment_events").insert(row);
    if (!error) return true;
    console.warn("[payment-events] Insert attempt failed:", error.message);
  }

  console.error("[payment-events] All insert attempts failed for", event.endpoint);
  return false;
}