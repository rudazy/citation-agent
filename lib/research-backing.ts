/**
 * Research-backing display helpers (attestation stakes framed as catalog copy).
 */

import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import type { TargetSummary } from "@/lib/attestation-index";

export type ResearchBackingStats = {
  /** Distinct wallets that staked behind this target. */
  backers: number;
  /** Total on-chain stake amount (USDC, 6 decimals string from index). */
  total_usdc: string;
  /** Individual stake transactions (may exceed backers when people back twice). */
  stakes: number;
};

export function authorBackingTarget(author: string): string {
  return canonicalizeAttestationTarget(`author:${author.trim()}`);
}

export function reportBackingTarget(postId: string): string {
  return canonicalizeAttestationTarget(`citation:${postId.trim()}`);
}

export function summarizeBackingRow(row: TargetSummary | undefined): ResearchBackingStats | null {
  if (!row || row.backerCount < 1) return null;
  const total = parseFloat(row.totalUsdc);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    backers: row.backerCount,
    total_usdc: row.totalUsdc,
    stakes: row.claimCount,
  };
}

export function indexBackingSummaries(
  rows: TargetSummary[],
): Map<string, ResearchBackingStats> {
  const map = new Map<string, ResearchBackingStats>();
  for (const row of rows) {
    const stats = summarizeBackingRow(row);
    if (stats) map.set(row.target, stats);
  }
  return map;
}

function formatUsdcAmount(raw: string): string {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, "");
  if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, "");
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Subtle catalog hint, e.g. "2 backers · 1.5 USDC". */
export function formatBackingHint(
  stats: ResearchBackingStats | null | undefined,
): string | null {
  if (!stats || stats.backers < 1) return null;
  const amount = formatUsdcAmount(stats.total_usdc);
  const people =
    stats.backers === 1 ? "1 backer" : `${stats.backers} backers`;
  return `${people} · ${amount} USDC`;
}

export function formatResearcherBackingHint(
  stats: ResearchBackingStats | null | undefined,
): string | null {
  const base = formatBackingHint(stats);
  if (!base) return null;
  return `${base} behind researcher`;
}

export function formatReportBackingHint(
  stats: ResearchBackingStats | null | undefined,
): string | null {
  const base = formatBackingHint(stats);
  if (!base) return null;
  return `${base} behind report`;
}