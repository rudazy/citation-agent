import { NextResponse } from "next/server";
import { verifyOperatorRequest } from "@/lib/operator";
import { listOpenDisputes } from "@/lib/signal-resolution-store";

/**
 * Disputes still waiting on an operator action.
 *
 * Operator-only: it exposes stake indices and dispute internals that serve no
 * public purpose, and the public resolution view already carries everything a
 * reader needs about a settled dispute.
 */
export async function GET(request: Request) {
  if (!(await verifyOperatorRequest(request))) {
    return NextResponse.json({ error: "Operator signature required" }, { status: 401 });
  }

  const disputes = await listOpenDisputes();

  return NextResponse.json(
    {
      disputes: disputes.map((d) => ({
        post_id: d.postId,
        title: d.title,
        author: d.author,
        stage: d.stage,
        outcome: d.outcome,
        adjudicated_outcome: d.adjudicatedOutcome,
        disputed_at: d.disputedAt,
        dispute_stake_usdc: d.disputeStakeUsdc,
        dispute_reason: d.disputeReason,
        dispute_tx: d.disputeTx,
        stake_index: d.disputeStakeIndex,
        stake_frozen_at: d.stakeFrozenAt,
        next: d.next,
        blocked_reason: d.blockedReason,
      })),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
