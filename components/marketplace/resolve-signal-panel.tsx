"use client";

import { useCallback, useEffect, useState } from "react";
import { Gavel, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResolutionBadge } from "@/components/marketplace/resolution-badge";
import { formatPaymentDate } from "@/lib/format-datetime";
import {
  DISPUTE_WINDOW_HOURS,
  SIGNAL_OUTCOMES,
  SIGNAL_OUTCOME_LABELS,
  type ResolutionStatus,
  type SignalOutcome,
} from "@/lib/signal-resolution";
import { cn } from "@/lib/utils";

type ResolutionPayload = {
  status: ResolutionStatus;
  effective_outcome: SignalOutcome | null;
  can_dispute: boolean;
  dispute_target: string;
  min_dispute_stake_usdc: number;
  outcome?: SignalOutcome;
  note?: string | null;
  resolved_at?: string;
  dispute_window_ends_at?: string;
  disputed_at?: string | null;
  dispute_reason?: string | null;
  adjudicated_outcome?: SignalOutcome | null;
};

type Props = {
  postId: string;
  /** Only the publishing desk may file an outcome. */
  isOwner: boolean;
  className?: string;
};

/**
 * Outcome logging for a Signal Card.
 *
 * The owner files right / wrong / void once — resolutions are immutable, since
 * an editable outcome log would be worthless as proof of judgment. Everyone
 * else sees the outcome and, during the window, how to challenge it.
 */
export function ResolveSignalPanel({ postId, isOwner, className }: Props) {
  const [resolution, setResolution] = useState<ResolutionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SignalOutcome>("right");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/marketplace/resolutions?postId=${encodeURIComponent(postId)}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { resolution?: ResolutionPayload };
      if (data.resolution) setResolution(data.resolution);
    } catch {
      // Outcome state is supplementary; never block the card on it.
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/marketplace/resolutions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId, outcome, note: note.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        resolution?: ResolutionPayload;
      };
      if (!res.ok) {
        toast.error("Could not resolve", {
          description: data.error ?? `Error ${res.status}`,
        });
        return;
      }
      if (data.resolution) setResolution(data.resolution);
      setNote("");
      toast.success("Outcome filed", {
        description: `Public now, and final in ${DISPUTE_WINDOW_HOURS}h if undisputed.`,
      });
    } catch (err) {
      toast.error("Could not resolve", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, note, outcome, postId]);

  if (loading) return null;

  const resolved = resolution && resolution.status !== "unresolved";

  return (
    <div
      className={cn(
        "space-y-2 rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[#555]">
          <Gavel size={11} className="text-[#f5c842]" />
          Outcome
        </p>
        {resolution && (
          <ResolutionBadge
            status={resolution.status}
            outcome={resolution.effective_outcome}
          />
        )}
      </div>

      {resolved ? (
        <div className="space-y-1">
          {resolution?.note && (
            <p className="font-mono text-[11px] leading-relaxed text-[#888]">
              &ldquo;{resolution.note}&rdquo;
            </p>
          )}
          {resolution?.resolved_at && (
            <p className="font-mono text-[10px] text-[#555]">
              Filed {formatPaymentDate(resolution.resolved_at)}
              {resolution.status === "provisional" && resolution.dispute_window_ends_at
                ? ` · final ${formatPaymentDate(resolution.dispute_window_ends_at)}`
                : ""}
            </p>
          )}
          {resolution?.status === "disputed" && (
            <p className="font-mono text-[10px] leading-relaxed text-[#c8a050]">
              Challenged with a USDC stake. Excluded from accuracy until an
              operator settles it.
              {resolution.dispute_reason ? ` — "${resolution.dispute_reason}"` : ""}
            </p>
          )}
          {resolution?.can_dispute && !isOwner && (
            <p className="font-mono text-[10px] leading-relaxed text-[#666]">
              Disagree? Stake at least {resolution.min_dispute_stake_usdc} USDC
              against <span className="text-[#888]">{resolution.dispute_target}</span>{" "}
              from the backing flow, then submit the tx to dispute.
            </p>
          )}
        </div>
      ) : isOwner ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] leading-relaxed text-[#666]">
            File the outcome against the invalidation you committed to. This is
            written once and cannot be edited.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SIGNAL_OUTCOMES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutcome(value)}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[10px] transition-colors",
                  outcome === value
                    ? "border-[#f5c842]/40 bg-[#f5c842]/10 text-[#f5c842]"
                    : "border-[#1f1f1f] text-[#666] hover:border-[#333] hover:text-[#a3a3a3]",
                )}
              >
                {SIGNAL_OUTCOME_LABELS[value]}
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="What happened (optional)"
            className="h-8 border-[#333] bg-[#0a0a0a] font-mono text-[11px]"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void submit()}
            className="gap-1.5 border-[#f5c842]/35 font-mono text-xs text-[#f5c842]"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
            File outcome
          </Button>
        </div>
      ) : (
        <p className="font-mono text-[10px] text-[#666]">
          {resolution?.status === "expired_unresolved"
            ? "Horizon passed with no outcome filed by this desk."
            : "No outcome filed yet."}
        </p>
      )}
    </div>
  );
}
