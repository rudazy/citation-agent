/**
 * L1 memory + L2 Supabase cache for paid TrustGate scores.
 *
 * Serverless instances do not share memory; Supabase keeps a successful lookup
 * from triggering repeat oracle calls (and rate limits) across requests.
 */

import { getAdminClient } from "@/lib/supabase/admin";
import {
  getCachedPaidScore as getMemoryCachedPaidScore,
  paidScoreCacheTtlMs,
  setCachedPaidScore as setMemoryCachedPaidScore,
  type PaidTrustScore,
} from "@/lib/trustgate-paid";

type CacheHit = { hit: boolean; value: PaidTrustScore | null };

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function rowToScore(row: {
  score: number | string | null;
  tier: string | null;
  recommendation: string | null;
}): PaidTrustScore | null {
  const score = typeof row.score === "number" ? row.score : Number(row.score);
  if (!Number.isFinite(score)) return null;
  return {
    score,
    tier: row.tier ?? "",
    recommendation: row.recommendation ?? "",
  };
}

export async function getCachedPaidScore(address: string): Promise<CacheHit> {
  const memory = getMemoryCachedPaidScore(address);
  if (memory.hit) return memory;

  const supabase = getAdminClient();
  if (!supabase) return { hit: false, value: null };

  const wallet = normalizeAddress(address);
  const { data, error } = await supabase
    .from("paid_trust_cache")
    .select("score, tier, recommendation, expires_at")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (error || !data) return { hit: false, value: null };

  const expiresAt = new Date(data.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    void supabase.from("paid_trust_cache").delete().eq("wallet_address", wallet);
    return { hit: false, value: null };
  }

  const value = data.score === null ? null : rowToScore(data);
  setMemoryCachedPaidScore(address, value);
  return { hit: true, value };
}

export async function setCachedPaidScore(
  address: string,
  value: PaidTrustScore | null,
): Promise<void> {
  setMemoryCachedPaidScore(address, value);

  const supabase = getAdminClient();
  if (!supabase) return;

  const wallet = normalizeAddress(address);
  const ttlMs = paidScoreCacheTtlMs(value);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  await supabase.from("paid_trust_cache").upsert(
    {
      wallet_address: wallet,
      score: value?.score ?? null,
      tier: value?.tier ?? null,
      recommendation: value?.recommendation ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address" },
  );
}