import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type AttestationPlatformFee = {
  id: string;
  created_at: string;
  attest_tx_hash: string;
  staker: string;
  target: string;
  stake_usdc: string;
  platform_fee_usdc: string;
  recipient: string;
};

export function useAttestationFees() {
  const [fees, setFees] = useState<AttestationPlatformFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<ReturnType<typeof createClient>>(null);

  const fetchFees = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setLoading(false);
      setError("Supabase not configured");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await client
      .from("attestation_platform_fees")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setFees(data as AttestationPlatformFee[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    clientRef.current = supabase;
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    const channel = client
      .channel("attestation-fees-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attestation_platform_fees" },
        (payload) => {
          const row = payload.new as AttestationPlatformFee;
          setFees((prev) => (prev.some((f) => f.id === row.id) ? prev : [row, ...prev]));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void fetchFees();
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [fetchFees]);

  const totalFees = fees.reduce(
    (sum, row) => sum + parseFloat(row.platform_fee_usdc || "0"),
    0,
  );

  return { fees, loading, error, totalFees, refetch: fetchFees };
}