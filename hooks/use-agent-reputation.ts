import { useCallback, useEffect, useState } from "react";

export type AgentReputation = {
  payer: string;
  total_spent_usdc: number;
  citation_count: number;
  last_payment_at: string | null;
  updated_at: string;
};

type UseAgentReputationOptions = {
  /** Only fetch when the viewer is the operator (avoids prompting non-operators). */
  enabled?: boolean;
  /** Returns signed operator headers for the gated /api/dashboard route. */
  getAuthHeaders: () => Promise<Record<string, string>>;
  /** Poll interval; the ledger is no longer realtime (RLS-locked tables). */
  pollMs?: number;
};

/**
 * Agent spend leaderboard, read through the operator-gated API route (service-role
 * admin client). Polls rather than subscribing to Supabase Realtime.
 */
export function useAgentReputation({
  enabled = true,
  getAuthHeaders,
  pollMs = 12000,
}: UseAgentReputationOptions) {
  const [agents, setAgents] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    if (!enabled) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/dashboard/agent-reputation", {
        cache: "no-store",
        headers,
      });
      if (!res.ok) {
        setAgents([]);
        return;
      }
      const data = (await res.json()) as { agents?: AgentReputation[] };
      setAgents(data.agents ?? []);
    } catch (err) {
      console.error("Failed to fetch agent reputation:", err);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, getAuthHeaders]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchAgents();
    const id = setInterval(() => void fetchAgents(), pollMs);
    return () => clearInterval(id);
  }, [enabled, fetchAgents, pollMs]);

  return { agents, loading, refetch: fetchAgents };
}
