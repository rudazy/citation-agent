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
  /** Only fetch when the viewer is the operator (avoids prompting non-operators). */
  enabled?: boolean;
  /** Returns signed operator headers for the gated /api/dashboard route. */
  getAuthHeaders: () => Promise<Record<string, string>>;
  /** Poll interval; the ledger is no longer realtime (RLS-locked tables). */
  pollMs?: number;
};

/**
 * Creator royalty ledger, read through the operator-gated API route (service-role
 * admin client). The financial tables are not anon-readable, so this polls rather
 * than subscribing to Supabase Realtime.
 */
export function useCreatorEarnings({
  enabled = true,
  getAuthHeaders,
  pollMs = 12000,
}: UseCreatorEarningsOptions) {
  const [earnings, setEarnings] = useState<CreatorEarning[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    if (!enabled) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/dashboard/creator-earnings", {
        cache: "no-store",
        headers,
      });
      if (!res.ok) {
        setEarnings([]);
        return;
      }
      const data = (await res.json()) as { earnings?: CreatorEarning[] };
      setEarnings(data.earnings ?? []);
    } catch (err) {
      console.error("Failed to fetch creator earnings:", err);
      setEarnings([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, getAuthHeaders]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchEarnings();
    const id = setInterval(() => void fetchEarnings(), pollMs);
    return () => clearInterval(id);
  }, [enabled, fetchEarnings, pollMs]);

  return { earnings, loading, refetch: fetchEarnings };
}
