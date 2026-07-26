/**
 * Curator economics (Phase 2) — attribution ledger for routed unlocks.
 *
 * Settlement is unchanged: an unlock still pays 100% on-chain to the creator's
 * payout wallet through the existing single-payee x402 rails. What accrues here
 * is the curator's *credit* for having routed that unlock. Paying that credit
 * out is a later phase, so every row lands with settled_at = null.
 *
 * Forging attribution costs the forger a real USDC unlock and credits somebody
 * else, so the guards below are about correctness rather than spam: a curator
 * cannot credit themselves, cannot credit the author, and a given buyer can
 * only mint credit once per post.
 */

import { getAddress } from "viem";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  computeCuratorShareUsdc,
  summarizeCuratorCredit,
  EMPTY_CURATOR_CREDIT,
  type AttributionLedgerRow,
  type AttributionSource,
  type CuratorCreditSummary,
} from "@/lib/curator-share";
import { hasEndorsed } from "@/lib/endorsements";
import { createNotification } from "@/lib/notifications";
import { getProfileByUsername, getProfileByWallet } from "@/lib/platform-profile";
import { normalizeReferralCode } from "@/lib/referral";

export {
  ATTRIBUTION_SOURCES,
  CURATOR_SHARE_RATES,
  EMPTY_CURATOR_CREDIT,
  computeCuratorShareUsdc,
  summarizeCuratorCredit,
  type AttributionSource,
  type CuratorCreditSummary,
} from "@/lib/curator-share";

function normalizePayer(payer: string): string | null {
  try {
    return getAddress(payer.trim()).toLowerCase();
  } catch {
    return null;
  }
}

export type AttributionOutcome =
  | { recorded: true; source: AttributionSource; curatorShareUsdc: string }
  | { recorded: false; reason: string };

/**
 * Credit a curator for an unlock they routed. Best-effort by design: every
 * rejection path returns a reason instead of throwing, because attribution must
 * never fail an unlock the buyer has already paid for.
 */
export async function recordUnlockAttribution(params: {
  postId: string;
  /** Raw `ref` value from the unlock request. */
  referralCode: string | null | undefined;
  /** Post author username — authors cannot be credited on their own work. */
  authorUsername: string;
  payer: string;
  grossUsdc: string;
  gatewayTx?: string | null;
}): Promise<AttributionOutcome> {
  const code = normalizeReferralCode(params.referralCode);
  if (!code) return { recorded: false, reason: "no referral code" };

  if (code === params.authorUsername.trim().toLowerCase()) {
    return { recorded: false, reason: "author cannot be their own curator" };
  }

  const payer = normalizePayer(params.payer);
  if (!payer) return { recorded: false, reason: "payer is not a valid address" };

  const supabase = getAdminClient();
  if (!supabase) return { recorded: false, reason: "attribution not configured" };

  const curator = await getProfileByUsername(code);
  if (!curator) return { recorded: false, reason: "unknown curator" };

  // Self-referral: the buyer's own wallet resolves to the curator's profile.
  const payerProfile = await getProfileByWallet(payer);
  if (payerProfile && payerProfile.id === curator.id) {
    return { recorded: false, reason: "buyer cannot credit themselves" };
  }

  const source: AttributionSource = (await hasEndorsed(params.postId, curator.id))
    ? "endorsement"
    : "referral";
  const curatorShareUsdc = computeCuratorShareUsdc(params.grossUsdc, source);

  const { error } = await supabase.from("unlock_attributions").insert({
    post_id: params.postId,
    curator_profile_id: curator.id,
    source,
    payer,
    gross_usdc: params.grossUsdc,
    curator_share_usdc: curatorShareUsdc,
    gateway_tx: params.gatewayTx ?? null,
  });

  if (error) {
    // 23505 = unique violation: this buyer already credited this post.
    if (error.code === "23505") {
      return { recorded: false, reason: "buyer already credited this post" };
    }
    console.error("[unlock-attribution] insert failed:", error.message);
    return { recorded: false, reason: "ledger insert failed" };
  }

  await createNotification({
    profileId: curator.id,
    type: "curator_credit",
    postId: params.postId,
  });

  return { recorded: true, source, curatorShareUsdc };
}

export async function getCuratorCreditSummary(
  curatorProfileId: string,
): Promise<CuratorCreditSummary> {
  const supabase = getAdminClient();
  if (!supabase) return EMPTY_CURATOR_CREDIT;

  const { data, error } = await supabase
    .from("unlock_attributions")
    .select("source, curator_share_usdc, settled_at")
    .eq("curator_profile_id", curatorProfileId)
    .limit(5_000);

  if (error) {
    console.warn("[unlock-attribution] credit summary failed:", error.message);
    return EMPTY_CURATOR_CREDIT;
  }

  return summarizeCuratorCredit((data ?? []) as AttributionLedgerRow[]);
}

export type CuratorAttribution = {
  postId: string;
  source: AttributionSource;
  curatorShareUsdc: string;
  grossUsdc: string;
  createdAt: string;
  settled: boolean;
};

/** Recent attributed unlocks for a curator's own desk analytics. */
export async function listCuratorAttributions(
  curatorProfileId: string,
  limit = 25,
): Promise<CuratorAttribution[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("unlock_attributions")
    .select("post_id, source, gross_usdc, curator_share_usdc, created_at, settled_at")
    .eq("curator_profile_id", curatorProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[unlock-attribution] list failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    postId: String(row.post_id),
    source: row.source as AttributionSource,
    curatorShareUsdc: String(row.curator_share_usdc),
    grossUsdc: String(row.gross_usdc),
    createdAt: String(row.created_at),
    settled: Boolean(row.settled_at),
  }));
}
