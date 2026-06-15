import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AgentReputation = {
  payer: string;
  total_spent_usdc: number;
  citation_count: number;
  last_payment_at: string | null;
  updated_at: string;
};

export function useAgentReputation() {
  const [agents, setAgents] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchAgents() {
      const { data, error } = await supabase
        .from("agent_reputation")
        .select("*")
        .order("total_spent_usdc", { ascending: false });

      if (error) {
        console.error("Failed to fetch agent reputation:", error.message);
      } else {
        setAgents((data ?? []) as AgentReputation[]);
      }
      setLoading(false);
    }

    fetchAgents();

    const channel = supabase
      .channel("agent-reputation-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_reputation" },
        () => fetchAgents(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { agents, loading };
}