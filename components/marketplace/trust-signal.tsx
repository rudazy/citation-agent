"use client";

import { Badge } from "@/components/ui/badge";
import {
  formatTrustLabel,
  type PublicTrustSignal,
} from "@/lib/creator-trust";
import { cn } from "@/lib/utils";

export type { PublicTrustSignal };

type Props = {
  trust: PublicTrustSignal | null | undefined;
  className?: string;
};

/** Shown only when a score exists — ranking is otherwise invisible to buyers. */
export function TrustSignalBadge({ trust, className }: Props) {
  const label = formatTrustLabel(trust);
  if (!label) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-[#333] font-mono text-[10px] text-[#666]",
        className,
      )}
      title="Researcher reputation influences catalog ranking"
    >
      Score {label}
    </Badge>
  );
}