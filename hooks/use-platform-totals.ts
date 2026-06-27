import { useCallback, useEffect, useState } from "react";
import type { PlatformTotals } from "@/lib/platform-totals";

const DEFAULT_POLL_MS = 5000;

type UsePlatformTotalsOptions = {
  /** Poll interval for live aggregate updates. */
  pollMs?: number;
  enabled?: boolean;
};

/**
 * Public platform aggregate totals (counts and sums only). Polls the unauthenticated
 * /api/dashboard/aggregates route — never touches the RLS-locked ledger tables.
 */
export function usePlatformTotals({
  pollMs = DEFAULT_POLL_MS,
  enabled = true,
}: UsePlatformTotalsOptions = {}) {
  const [totals, setTotals] = useState<PlatformTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTotals = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/dashboard/aggregates", { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed to load platform totals (${res.status})`);
        return;
      }
      const data = (await res.json()) as PlatformTotals;
      setTotals(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform totals");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchTotals();
    const id = setInterval(() => void fetchTotals(), pollMs);
    return () => clearInterval(id);
  }, [enabled, fetchTotals, pollMs]);

  return { totals, loading, error, refetch: fetchTotals };
}