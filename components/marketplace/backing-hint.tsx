"use client";

import {
  formatReportBackingHint,
  formatResearcherBackingHint,
  type ResearchBackingStats,
} from "@/lib/research-backing";

type Props = {
  authorBacking?: ResearchBackingStats | null;
  reportBacking?: ResearchBackingStats | null;
};

/** Minimal on-card backing signal — hidden when zero. */
export function BackingHint({ authorBacking, reportBacking }: Props) {
  const line =
    formatResearcherBackingHint(authorBacking) ??
    formatReportBackingHint(reportBacking);
  if (!line) return null;

  return (
    <p className="font-mono text-[10px] leading-relaxed text-[#555]">{line}</p>
  );
}