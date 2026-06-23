"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

export type PublicTrustSignal = {
  score: number;
  tier: string;
  confidence: number;
  recommendation?: string;
  source: "free" | "paid";
};

export function formatTrustLabel(signal: PublicTrustSignal | null | undefined): string | null {
  if (!signal) return null;
  const parts = [`${signal.score}`];
  if (signal.tier) parts.push(signal.tier);
  if (signal.recommendation) parts.push(signal.recommendation);
  return parts.join(" · ");
}

type Props = {
  trust: PublicTrustSignal | null | undefined;
  className?: string;
};

/** Visible trust score for a creator. Never shows a wallet address. */
export function TrustSignalBadge({ trust, className }: Props) {
  const label = formatTrustLabel(trust);
  if (!label) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-[#333] font-mono text-[10px] text-[#666]",
          className,
        )}
      >
        <Shield size={10} />
        Unscored
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-[#ff8a3d]/30 font-mono text-[10px] text-[#ff8a3d]",
        trust?.source === "paid" && "border-[#f5c842]/40 text-[#f5c842]",
        className,
      )}
      title={
        trust?.source === "paid"
          ? "Paid TrustGate lookup (wallet hidden)"
          : "Free TrustGate reader (wallet hidden)"
      }
    >
      <Shield size={10} />
      TrustGate {label}
    </Badge>
  );
}