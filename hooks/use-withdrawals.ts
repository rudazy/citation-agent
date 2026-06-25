import { useCallback, useEffect, useState } from "react";

export type Withdrawal = {
  id: string;
  created_at: string;
  amount_usdc: string;
  destination_chain: string;
  destination_address: string;
  status: "submitted" | "confirmed" | "failed";
  tx_hash: string | null;
  wallet_address?: string | null;
  role?: "seller" | "agent" | null;
};

export type WithdrawalScope = "agent" | "seller";

type UseWithdrawalsOptions = {
  scope?: WithdrawalScope;
  /** Required when scope is seller (operator-only withdrawal history). */
  getAuthHeaders?: () => Promise<Record<string, string>>;
};

export function useWithdrawals({
  scope = "agent",
  getAuthHeaders,
}: UseWithdrawalsOptions = {}) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const headers =
        scope === "seller" && getAuthHeaders ? await getAuthHeaders() : undefined;
      const res = await fetch(`/api/gateway/withdrawals?scope=${scope}`, {
        cache: "no-store",
        headers,
      });
      if (!res.ok) {
        setWithdrawals([]);
        return;
      }
      const data = (await res.json()) as { withdrawals?: Withdrawal[] };
      setWithdrawals(data.withdrawals ?? []);
    } catch {
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, scope]);

  useEffect(() => {
    void fetchWithdrawals();
  }, [fetchWithdrawals]);

  return { withdrawals, loading, refetch: fetchWithdrawals };
}