import { useCallback, useEffect, useState } from "react";

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

type UseAttestationFeesOptions = {
  /** Only the operator may fetch fee data; disabled otherwise. */
  enabled?: boolean;
  /** Produces operator auth headers (signs on demand). Required when enabled. */
  getAuthHeaders?: () => Promise<Record<string, string>>;
};

/**
 * Operator-only platform fee ledger. Fetched from the operator-authenticated
 * server route (not read directly from Supabase), so non-operators cannot
 * retrieve fee data.
 */
export function useAttestationFees({
  enabled = false,
  getAuthHeaders,
}: UseAttestationFeesOptions = {}) {
  const [fees, setFees] = useState<AttestationPlatformFee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    if (!enabled || !getAuthHeaders) {
      setFees([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/attestation/fees", { headers, cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load fees (${res.status})`);
      }
      const data = (await res.json()) as { fees?: AttestationPlatformFee[] };
      setFees(data.fees ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attestation fees");
      setFees([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, getAuthHeaders]);

  useEffect(() => {
    if (enabled) {
      void fetchFees();
    } else {
      setFees([]);
      setError(null);
    }
  }, [enabled, fetchFees]);

  const totalFees = fees.reduce(
    (sum, row) => sum + parseFloat(row.platform_fee_usdc || "0"),
    0,
  );

  return { fees, loading, error, totalFees, refetch: fetchFees };
}
