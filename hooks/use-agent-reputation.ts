import { useCallback, useEffect, useState } from "react";

export type AgentReputation = {
  payer: string;
  total_spent_usdc: number;
  citation_count: number;
  last_payment_at: string | null;
  updated_at: string;
};

type UseAgentReputationOptions = {
  enabled?: boolean;
  getAuthHeaders?: () => Promise<Record<string, string>>;
};

/** Operator-only agent spend leaderboard. */
export function useAgentReputation({
  enabled = false,
  getAuthHeaders,
}: UseAgentReputationOptions = {}) {
  const [agents, setAgents] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    if (!enabled || !getAuthHeaders) {
      setAgents([]);
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/dashboard/agent-reputation", {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        setAgents([]);
        return;
      }
      const data = (await res.json()) as { agents?: AgentReputation[] };
      setAgents(data.agents ?? []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, getAuthHeaders]);

  useEffect(() => {
    if (enabled) {
      void fetchAgents();
    } else {
      setAgents([]);
      setLoading(false);
    }
  }, [enabled, fetchAgents]);

  return { agents, loading, refetch: fetchAgents };
}