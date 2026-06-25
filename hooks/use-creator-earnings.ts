import { useCallback, useEffect, useState } from "react";

export type CreatorEarning = {
  id: string;
  created_at: string;
  citation_id: string;
  creator_name: string;
  creator_wallet: string;
  payer: string;
  gross_usdc: string;
  royalty_usdc: string;
  platform_usdc: string;
  gateway_tx: string | null;
  query: string | null;
};

type UseCreatorEarningsOptions = {
  enabled?: boolean;
  getAuthHeaders?: () => Promise<Record<string, string>>;
};

/** Operator-only creator royalty ledger. */
export function useCreatorEarnings({
  enabled = false,
  getAuthHeaders,
}: UseCreatorEarningsOptions = {}) {
  const [earnings, setEarnings] = useState<CreatorEarning[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!enabled || !getAuthHeaders) {
      setEarnings([]);
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/dashboard/creator-earnings", {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        setEarnings([]);
        return;
      }
      const data = (await res.json()) as { earnings?: CreatorEarning[] };
      setEarnings(data.earnings ?? []);
    } catch {
      setEarnings([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, getAuthHeaders]);

  useEffect(() => {
    if (enabled) {
      void fetchEarnings();
    } else {
      setEarnings([]);
      setLoading(false);
    }
  }, [enabled, fetchEarnings]);

  return { earnings, loading, refetch: fetchEarnings };
}