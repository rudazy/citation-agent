"use client";

import { AlertTriangle, CircleDot, Clock, Gavel, ShieldCheck, XCircle } from "lucide-react";
import {
  RESOLUTION_STATUS_LABELS,
  SIGNAL_OUTCOME_LABELS,
  type ResolutionStatus,
  type SignalOutcome,
} from "@/lib/signal-resolution";
import { cn } from "@/lib/utils";

type Props = {
  status: ResolutionStatus;
  outcome?: SignalOutcome | null;
  className?: string;
};

/**
 * Public outcome marker for a Signal Card.
 *
 * A provisional or disputed outcome is never styled like a settled one — the
 * whole point of the dispute window is that an outcome is not proof until it
 * survives challenge.
 */
export function ResolutionBadge({ status, outcome, className }: Props) {
  if (status === "unresolved") return null;

  const settled = status === "final" || status === "adjudicated";
  const label = settled && outcome ? SIGNAL_OUTCOME_LABELS[outcome] : RESOLUTION_STATUS_LABELS[status];

  const tone =
    status === "disputed"
      ? "border-[#c8a050]/40 bg-[#c8a050]/10 text-[#c8a050]"
      : status === "expired_unresolved"
        ? "border-[#444] bg-[#1a1a1a] text-[#888]"
        : status === "provisional"
          ? "border-[#333] bg-[#141414] text-[#a3a3a3]"
          : outcome === "right"
            ? "border-[#c8f135]/35 bg-[#c8f135]/10 text-[#c8f135]"
            : outcome === "wrong"
              ? "border-[#a05050]/40 bg-[#a05050]/10 text-[#c88080]"
              : "border-[#333] bg-[#141414] text-[#888]";

  const Icon =
    status === "disputed"
      ? AlertTriangle
      : status === "expired_unresolved"
        ? Clock
        : status === "provisional"
          ? CircleDot
          : status === "adjudicated"
            ? Gavel
            : outcome === "wrong"
              ? XCircle
              : ShieldCheck;

  const title =
    status === "provisional"
      ? "Filed by the desk — still open to dispute"
      : status === "disputed"
        ? "Challenged with a USDC stake — excluded from accuracy until settled"
        : status === "expired_unresolved"
          ? "Horizon passed with no outcome filed"
          : status === "adjudicated"
            ? "Dispute settled by adjudication"
            : "Dispute window closed undisputed";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px]",
        tone,
        className,
      )}
    >
      <Icon size={11} className="shrink-0" />
      {label}
      {status === "adjudicated" && outcome ? " · adjudicated" : ""}
    </span>
  );
}
