import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

export function useCreatorEarnings() {
  const [earnings, setEarnings] = useState<CreatorEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchInitial() {
      const { data, error } = await supabase
        .from("creator_earnings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch creator earnings:", error.message);
      } else {
        setEarnings((prev) => {
          if (prev.length === 0) return data as CreatorEarning[];
          const fetched = data as CreatorEarning[];
          const existingIds = new Set(fetched.map((e) => e.id));
          const realtimeOnly = prev.filter((e) => !existingIds.has(e.id));
          return [...realtimeOnly, ...fetched];
        });
      }
      setLoading(false);
    }

    const channel = supabase
      .channel("creator-earnings-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "creator_earnings" },
        (payload) => {
          setEarnings((prev) => {
            const row = payload.new as CreatorEarning;
            if (prev.some((e) => e.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchInitial();
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { earnings, loading };
}