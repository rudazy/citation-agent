/**
 * Signal resolution persistence (Phase 3).
 *
 * Disputes reuse the existing attestation rails: a challenger stakes USDC
 * on-chain against `resolution:{postId}` and submits the tx hash, which is
 * verified against Attestation.sol before the dispute is accepted. Nothing here
 * mints or moves funds itself.
 */

import { getAdminClient } from "@/lib/supabase/admin";
import { getPublishedPostById } from "@/lib/creator-posts";
import { createNotification } from "@/lib/notifications";
import { getProfileByUsername } from "@/lib/platform-profile";
import {
  disputeWindowEndsAtMs,
  isSignalOutcome,
  isSufficientDisputeStake,
  resolutionDisputeTarget,
  validateResolutionNote,
  type ResolutionRecord,
  type SignalOutcome,
} from "@/lib/signal-resolution";
import {
  verifyArbiterTx,
  verifyAttestationTx,
} from "@/lib/verify-attestation-tx";
import {
  disputeStage,
  isSettlementAction,
  settlementReadiness,
  validateBeneficiary,
  type DisputeStage,
  type SettlementAction,
} from "@/lib/dispute-settlement";

export type ResolutionRow = ResolutionRecord & {
  postId: string;
  resolvedAt: string;
  disputeStakeUsdc: string | null;
  disputeTx: string | null;
  disputeReason: string | null;
  adjudicationNote: string | null;
  /** Stake location on the attestation contract, for arbiter actions. */
  disputeStakeIndex: number | null;
  disputeContract: string | null;
  freezeTx: string | null;
  stakeFrozenAt: string | null;
  settlementAction: SettlementAction | null;
  settlementTx: string | null;
  settlementBeneficiary: string | null;
  settledAt: string | null;
};

export type ResolutionResult =
  | { ok: true; resolution: ResolutionRow }
  | { ok: false; error: string; status: number };

type DbRow = {
  post_id: string;
  created_at: string;
  outcome: string;
  note: string | null;
  dispute_window_ends_at: string;
  disputed_at: string | null;
  dispute_stake_usdc: string | number | null;
  dispute_tx: string | null;
  dispute_reason: string | null;
  adjudicated_at: string | null;
  adjudicated_outcome: string | null;
  adjudication_note: string | null;
  dispute_stake_index: number | string | null;
  dispute_contract: string | null;
  freeze_tx: string | null;
  stake_frozen_at: string | null;
  settlement_action: string | null;
  settlement_tx: string | null;
  settlement_beneficiary: string | null;
  settled_at: string | null;
};

function toResolution(row: DbRow): ResolutionRow {
  return {
    postId: String(row.post_id),
    resolvedAt: String(row.created_at),
    outcome: row.outcome as SignalOutcome,
    note: row.note,
    disputeWindowEndsAt: String(row.dispute_window_ends_at),
    disputedAt: row.disputed_at,
    disputeStakeUsdc:
      row.dispute_stake_usdc == null ? null : String(row.dispute_stake_usdc),
    disputeTx: row.dispute_tx,
    disputeReason: row.dispute_reason,
    adjudicatedAt: row.adjudicated_at,
    adjudicatedOutcome: (row.adjudicated_outcome as SignalOutcome | null) ?? null,
    adjudicationNote: row.adjudication_note,
    disputeStakeIndex:
      row.dispute_stake_index == null ? null : Number(row.dispute_stake_index),
    disputeContract: row.dispute_contract,
    freezeTx: row.freeze_tx,
    stakeFrozenAt: row.stake_frozen_at,
    settlementAction: isSettlementAction(row.settlement_action)
      ? row.settlement_action
      : null,
    settlementTx: row.settlement_tx,
    settlementBeneficiary: row.settlement_beneficiary,
    settledAt: row.settled_at,
  };
}

const SELECT_COLUMNS =
  "post_id, created_at, outcome, note, dispute_window_ends_at, disputed_at, dispute_stake_usdc, dispute_tx, dispute_reason, adjudicated_at, adjudicated_outcome, adjudication_note, dispute_stake_index, dispute_contract, freeze_tx, stake_frozen_at, settlement_action, settlement_tx, settlement_beneficiary, settled_at";

export async function getResolution(
  postId: string,
): Promise<ResolutionRow | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("signal_resolutions")
    .select(SELECT_COLUMNS)
    .eq("post_id", postId)
    .maybeSingle();

  if (error || !data) return null;
  return toResolution(data as DbRow);
}

/** Resolutions for a set of posts, for desk and catalog rollups. */
export async function getResolutionsForPosts(
  postIds: string[],
): Promise<Map<string, ResolutionRow>> {
  const out = new Map<string, ResolutionRow>();
  if (postIds.length === 0) return out;

  const supabase = getAdminClient();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("signal_resolutions")
    .select(SELECT_COLUMNS)
    .in("post_id", postIds.slice(0, 200));

  if (error) {
    console.warn("[signal-resolution] bulk load failed:", error.message);
    return out;
  }
  for (const row of data ?? []) {
    const resolution = toResolution(row as DbRow);
    out.set(resolution.postId, resolution);
  }
  return out;
}

/**
 * File an outcome for your own signal. One resolution per signal, and it cannot
 * be edited afterwards — an editable outcome log would be worthless as proof.
 */
export async function recordResolution(params: {
  postId: string;
  resolverProfileId: string;
  resolverUsername: string;
  outcome: unknown;
  note?: unknown;
}): Promise<ResolutionResult> {
  if (!isSignalOutcome(params.outcome)) {
    return { ok: false, error: "Outcome must be right, wrong, or void", status: 400 };
  }

  const noteResult = validateResolutionNote(params.note);
  if (!noteResult.ok) {
    return { ok: false, error: noteResult.error, status: 400 };
  }

  const post = await getPublishedPostById(params.postId);
  if (!post) {
    return { ok: false, error: "Signal not found", status: 404 };
  }
  if (post.postKind !== "signal") {
    return {
      ok: false,
      error: "Only Signal Cards can be resolved",
      status: 400,
    };
  }
  if (
    post.author.trim().toLowerCase() !==
    params.resolverUsername.trim().toLowerCase()
  ) {
    return {
      ok: false,
      error: "Only the desk that published a signal can resolve it",
      status: 403,
    };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Resolutions are not configured", status: 503 };
  }

  const now = Date.now();
  const { data, error } = await supabase
    .from("signal_resolutions")
    .insert({
      post_id: params.postId,
      resolver_profile_id: params.resolverProfileId,
      outcome: params.outcome,
      note: noteResult.note,
      dispute_window_ends_at: new Date(disputeWindowEndsAtMs(now)).toISOString(),
    })
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    // 23505 = unique violation on post_id: already resolved.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "This signal has already been resolved",
        status: 409,
      };
    }
    console.error("[signal-resolution] insert failed:", error.message);
    return { ok: false, error: "Failed to record resolution", status: 500 };
  }
  if (!data) {
    return { ok: false, error: "Failed to record resolution", status: 500 };
  }

  return { ok: true, resolution: toResolution(data as DbRow) };
}

/**
 * Challenge a resolution with an on-chain USDC stake.
 *
 * The tx is verified against Attestation.sol before anything is written: it
 * must be a successful `attest` call, filed against this resolution's canonical
 * target, at or above the minimum stake.
 */
export async function recordDispute(params: {
  postId: string;
  txHash: string;
  disputerProfileId: string | null;
  reason?: unknown;
}): Promise<ResolutionResult> {
  const txHash = params.txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { ok: false, error: "Invalid transaction hash", status: 400 };
  }

  const reasonResult = validateResolutionNote(params.reason);
  if (!reasonResult.ok) {
    return { ok: false, error: reasonResult.error, status: 400 };
  }

  const existing = await getResolution(params.postId);
  if (!existing) {
    return { ok: false, error: "This signal has no resolution to dispute", status: 404 };
  }
  if (existing.disputedAt) {
    return { ok: false, error: "This resolution is already disputed", status: 409 };
  }
  if (Date.now() >= new Date(existing.disputeWindowEndsAt).getTime()) {
    return { ok: false, error: "The dispute window has closed", status: 409 };
  }

  let verified: Awaited<ReturnType<typeof verifyAttestationTx>>;
  try {
    verified = await verifyAttestationTx(txHash as `0x${string}`);
  } catch (err) {
    console.warn(
      "[signal-resolution] dispute tx verification failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      error: "Could not verify the stake transaction on Arc. Try again shortly.",
      status: 502,
    };
  }

  if (!verified) {
    return {
      ok: false,
      error: "That transaction is not a successful attestation stake",
      status: 400,
    };
  }

  const expectedTarget = resolutionDisputeTarget(params.postId);
  if (verified.target.trim().toLowerCase() !== expectedTarget.toLowerCase()) {
    return {
      ok: false,
      error: `Stake must target ${expectedTarget}`,
      status: 400,
    };
  }
  if (!isSufficientDisputeStake(verified.stakeUsdc)) {
    return {
      ok: false,
      error: "Dispute stake is below the minimum",
      status: 400,
    };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Resolutions are not configured", status: 503 };
  }

  const { data, error } = await supabase
    .from("signal_resolutions")
    .update({
      disputed_at: new Date().toISOString(),
      disputer_profile_id: params.disputerProfileId,
      dispute_stake_usdc: verified.stakeUsdc,
      dispute_tx: txHash,
      dispute_reason: reasonResult.note,
      // Captured now because the arbiter functions address a stake by
      // (target, index), and the index is only exactly knowable from the
      // StakeOpened event on this transaction.
      dispute_stake_index: verified.stakeIndex,
      dispute_contract:
        verified.stakeIndex == null ? null : verified.contractAddress,
    })
    .eq("post_id", params.postId)
    // Re-check under the write so two concurrent disputes cannot both land.
    .is("disputed_at", null)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That transaction has already been used for a dispute",
        status: 409,
      };
    }
    console.error("[signal-resolution] dispute update failed:", error.message);
    return { ok: false, error: "Failed to record dispute", status: 500 };
  }
  if (!data) {
    return { ok: false, error: "This resolution is already disputed", status: 409 };
  }

  await notifyResolver(params.postId, "resolution_disputed");
  return { ok: true, resolution: toResolution(data as DbRow) };
}

/** Operator settles a dispute by fixing the outcome that stands. */
export async function adjudicateResolution(params: {
  postId: string;
  outcome: unknown;
  note?: unknown;
}): Promise<ResolutionResult> {
  if (!isSignalOutcome(params.outcome)) {
    return { ok: false, error: "Outcome must be right, wrong, or void", status: 400 };
  }

  const noteResult = validateResolutionNote(params.note);
  if (!noteResult.ok) {
    return { ok: false, error: noteResult.error, status: 400 };
  }

  const existing = await getResolution(params.postId);
  if (!existing) {
    return { ok: false, error: "Resolution not found", status: 404 };
  }
  if (!existing.disputedAt) {
    return {
      ok: false,
      error: "Only disputed resolutions can be adjudicated",
      status: 400,
    };
  }
  if (existing.adjudicatedAt) {
    return { ok: false, error: "This dispute is already settled", status: 409 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Resolutions are not configured", status: 503 };
  }

  const { data, error } = await supabase
    .from("signal_resolutions")
    .update({
      adjudicated_at: new Date().toISOString(),
      adjudicated_outcome: params.outcome,
      adjudication_note: noteResult.note,
    })
    .eq("post_id", params.postId)
    .is("adjudicated_at", null)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[signal-resolution] adjudication failed:", error.message);
    return { ok: false, error: "Failed to adjudicate", status: 500 };
  }
  if (!data) {
    return { ok: false, error: "This dispute is already settled", status: 409 };
  }

  await notifyResolver(params.postId, "resolution_adjudicated");
  return { ok: true, resolution: toResolution(data as DbRow) };
}

/**
 * Record that the operator froze the disputed stake on-chain.
 *
 * The tx already happened — the operator signed it in their own wallet, since
 * there is no server-side arbiter key. Everything is read back off the chain, so
 * a caller cannot claim a freeze that did not occur or point someone else's tx
 * at this resolution.
 */
export async function recordStakeFreeze(params: {
  postId: string;
  txHash: string;
}): Promise<ResolutionResult> {
  const txHash = params.txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { ok: false, error: "Invalid transaction hash", status: 400 };
  }

  const existing = await getResolution(params.postId);
  if (!existing) {
    return { ok: false, error: "Resolution not found", status: 404 };
  }
  if (!existing.disputedAt) {
    return { ok: false, error: "Only disputed stakes can be frozen", status: 400 };
  }
  if (existing.stakeFrozenAt) {
    return { ok: false, error: "This stake is already frozen", status: 409 };
  }
  if (existing.disputeStakeIndex == null) {
    return {
      ok: false,
      error:
        "This dispute has no on-chain stake index — the stake predates the current contract and cannot be settled",
      status: 409,
    };
  }

  let verified: Awaited<ReturnType<typeof verifyArbiterTx>>;
  try {
    verified = await verifyArbiterTx(txHash as `0x${string}`, {
      functionName: "freeze",
      target: resolutionDisputeTarget(params.postId),
      index: existing.disputeStakeIndex,
    });
  } catch (err) {
    console.warn(
      "[signal-resolution] freeze tx verification failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      error: "Could not verify the freeze transaction on Arc. Try again shortly.",
      status: 502,
    };
  }
  if (!verified) {
    return {
      ok: false,
      error: "That transaction is not a successful freeze of this dispute's stake",
      status: 400,
    };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Resolutions are not configured", status: 503 };
  }

  const { data, error } = await supabase
    .from("signal_resolutions")
    .update({ freeze_tx: txHash, stake_frozen_at: new Date().toISOString() })
    .eq("post_id", params.postId)
    .is("stake_frozen_at", null)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That transaction has already been recorded",
        status: 409,
      };
    }
    console.error("[signal-resolution] freeze update failed:", error.message);
    return { ok: false, error: "Failed to record the freeze", status: 500 };
  }
  if (!data) {
    return { ok: false, error: "This stake is already frozen", status: 409 };
  }

  return { ok: true, resolution: toResolution(data as DbRow) };
}

/**
 * Record the on-chain settlement of a disputed stake.
 *
 * The direction is *derived*, never supplied by the caller: an adjudication that
 * overturns the creator's call releases the stake to the challenger, one that
 * upholds it slashes the stake. The operator chooses the outcome and, for a
 * slash, the beneficiary — not whether a losing challenger is refunded anyway.
 */
export async function recordSettlement(params: {
  postId: string;
  txHash: string;
}): Promise<ResolutionResult> {
  const txHash = params.txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { ok: false, error: "Invalid transaction hash", status: 400 };
  }

  const existing = await getResolution(params.postId);
  if (!existing) {
    return { ok: false, error: "Resolution not found", status: 404 };
  }
  if (existing.disputeStakeIndex == null) {
    return {
      ok: false,
      error:
        "This dispute has no on-chain stake index — the stake predates the current contract and cannot be settled",
      status: 409,
    };
  }

  const readiness = settlementReadiness({
    state: {
      disputedAt: existing.disputedAt,
      stakeFrozenAt: existing.stakeFrozenAt,
      adjudicatedAt: existing.adjudicatedAt,
      settledAt: existing.settledAt,
    },
    originalOutcome: existing.outcome,
    adjudicatedOutcome: existing.adjudicatedOutcome,
    nowMs: Date.now(),
  });
  if (!readiness.ok) {
    return { ok: false, error: readiness.reason, status: 409 };
  }

  let verified: Awaited<ReturnType<typeof verifyArbiterTx>>;
  try {
    verified = await verifyArbiterTx(txHash as `0x${string}`, {
      functionName: readiness.action,
      target: resolutionDisputeTarget(params.postId),
      index: existing.disputeStakeIndex,
    });
  } catch (err) {
    console.warn(
      "[signal-resolution] settlement tx verification failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      error:
        "Could not verify the settlement transaction on Arc. Try again shortly.",
      status: 502,
    };
  }
  if (!verified) {
    return {
      ok: false,
      error: `That transaction is not a successful ${readiness.action} of this dispute's stake`,
      status: 400,
    };
  }

  // Beneficiary is taken from the chain, not the request body — the public
  // record must say where the money actually went.
  const beneficiaryResult = validateBeneficiary(
    readiness.action,
    verified.beneficiary,
  );
  if (!beneficiaryResult.ok) {
    return { ok: false, error: beneficiaryResult.error, status: 400 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Resolutions are not configured", status: 503 };
  }

  const { data, error } = await supabase
    .from("signal_resolutions")
    .update({
      settlement_action: readiness.action,
      settlement_tx: txHash,
      settlement_beneficiary: beneficiaryResult.beneficiary,
      settled_at: new Date().toISOString(),
    })
    .eq("post_id", params.postId)
    .is("settled_at", null)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That transaction has already been recorded",
        status: 409,
      };
    }
    console.error("[signal-resolution] settlement update failed:", error.message);
    return { ok: false, error: "Failed to record the settlement", status: 500 };
  }
  if (!data) {
    return { ok: false, error: "Stake already settled", status: 409 };
  }

  return { ok: true, resolution: toResolution(data as DbRow) };
}

/**
 * The settlement a resolution is currently waiting for, if any. Drives the
 * operator queue and tells the client which contract call to send.
 */
export function pendingSettlement(
  resolution: ResolutionRow,
  nowMs = Date.now(),
): { action: SettlementAction; index: number; target: string } | null {
  if (resolution.disputeStakeIndex == null) return null;
  const readiness = settlementReadiness({
    state: {
      disputedAt: resolution.disputedAt,
      stakeFrozenAt: resolution.stakeFrozenAt,
      adjudicatedAt: resolution.adjudicatedAt,
      settledAt: resolution.settledAt,
    },
    originalOutcome: resolution.outcome,
    adjudicatedOutcome: resolution.adjudicatedOutcome,
    nowMs,
  });
  if (!readiness.ok) return null;
  return {
    action: readiness.action,
    index: resolution.disputeStakeIndex,
    target: resolutionDisputeTarget(resolution.postId),
  };
}

/** Best-effort notification to the desk that filed the resolution. */
async function notifyResolver(
  postId: string,
  type: "resolution_disputed" | "resolution_adjudicated",
): Promise<void> {
  try {
    const post = await getPublishedPostById(postId);
    if (!post) return;
    const profile = await getProfileByUsername(post.author);
    if (!profile) return;
    await createNotification({ profileId: profile.id, type, postId });
  } catch (err) {
    console.warn("[signal-resolution] notification failed:", err);
  }
}

export type DisputeQueueEntry = ResolutionRow & {
  title: string;
  author: string;
  stage: DisputeStage;
  /** The contract call the operator should send next, if any. */
  next: { action: SettlementAction; index: number; target: string } | null;
  /** Why the next action is unavailable, when it is not. */
  blockedReason: string | null;
};

/**
 * Disputes that still need an operator action, oldest first.
 *
 * Settled disputes drop out entirely — this is a work queue, not a history.
 */
export async function listOpenDisputes(limit = 50): Promise<DisputeQueueEntry[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("signal_resolutions")
    .select(SELECT_COLUMNS)
    .not("disputed_at", "is", null)
    .is("settled_at", null)
    .order("disputed_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("[signal-resolution] dispute queue load failed:", error.message);
    return [];
  }

  const rows = (data ?? []).map((row) => toResolution(row as DbRow));
  if (rows.length === 0) return [];

  const { getPostSummariesByIds } = await import("@/lib/creator-posts");
  const summaries = await getPostSummariesByIds(rows.map((r) => r.postId));
  const now = Date.now();

  return rows.map((row) => {
    const summary = summaries.get(row.postId);
    const readiness = settlementReadiness({
      state: {
        disputedAt: row.disputedAt,
        stakeFrozenAt: row.stakeFrozenAt,
        adjudicatedAt: row.adjudicatedAt,
        settledAt: row.settledAt,
      },
      originalOutcome: row.outcome,
      adjudicatedOutcome: row.adjudicatedOutcome,
      nowMs: now,
    });

    return {
      ...row,
      title: summary?.title ?? row.postId,
      author: summary?.author ?? "unknown",
      stage: disputeStage({
        disputedAt: row.disputedAt,
        stakeFrozenAt: row.stakeFrozenAt,
        adjudicatedAt: row.adjudicatedAt,
        settledAt: row.settledAt,
      }),
      next: readiness.ok ? pendingSettlement(row, now) : null,
      blockedReason: readiness.ok ? null : readiness.reason,
    };
  });
}

export type RecentResolution = ResolutionRow & {
  title: string;
  author: string;
};

/** Newest resolutions, for the "just resolved" demand lane. */
export async function listRecentResolutions(
  limit = 10,
): Promise<RecentResolution[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("signal_resolutions")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[signal-resolution] recent load failed:", error.message);
    return [];
  }

  const rows = (data ?? []).map((row) => toResolution(row as DbRow));
  if (rows.length === 0) return [];

  const { getPostSummariesByIds } = await import("@/lib/creator-posts");
  const summaries = await getPostSummariesByIds(rows.map((r) => r.postId));

  return rows
    .map((row) => {
      const summary = summaries.get(row.postId);
      if (!summary) return null;
      return { ...row, title: summary.title, author: summary.author };
    })
    .filter((row): row is RecentResolution => row !== null);
}
