import { getAdminClient } from "@/lib/supabase/admin";

export async function fetchPaymentEventsForOperator() {
  const supabase = getAdminClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("payment_events")
    .select(
      "id, created_at, endpoint, payer, amount_usdc, network, gateway_tx, payment_memo",
    )
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

export async function fetchCreatorEarningsForOperator() {
  const supabase = getAdminClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("creator_earnings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

export async function fetchAgentReputationForOperator() {
  const supabase = getAdminClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("agent_reputation")
    .select("*")
    .order("total_spent_usdc", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}