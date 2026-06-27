"use client";

import { Panel } from "@/components/layout/panel";
import type { PlatformTotals } from "@/lib/platform-totals";

type Card = { label: string; value: string };

function buildCards(totals: PlatformTotals): Card[] {
  return [
    { label: "Payments", value: totals.payments.toLocaleString() },
    { label: "Royalties", value: totals.royalties.toLocaleString() },
    { label: "Agents", value: totals.agents.toLocaleString() },
    { label: "Total volume", value: `${totals.totalVolumeUsdc} USDC` },
    { label: "Paid to creators", value: `${totals.paidToCreatorsUsdc} USDC` },
  ];
}

type Props = {
  totals: PlatformTotals | null;
  loading?: boolean;
  /** Extra operator-only cards appended after the public totals. */
  extraCards?: Card[];
};

export function PlatformSummaryCards({ totals, loading, extraCards = [] }: Props) {
  const cards = totals ? [...buildCards(totals), ...extraCards] : null;
  const skeletonCount = 5 + extraCards.length;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
      {(cards ?? Array.from({ length: skeletonCount })).map((stat, i) => (
        <Panel key={cards ? (stat as Card).label : i} className="px-3 py-2.5 sm:px-4 sm:py-3">
          {cards ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {(stat as Card).label}
              </p>
              <p className="mt-0.5 font-mono text-lg sm:text-xl font-semibold tabular-nums">
                {(stat as Card).value}
              </p>
            </>
          ) : loading ? (
            <>
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-6 w-12 animate-pulse rounded bg-muted" />
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">—</p>
              <p className="mt-0.5 font-mono text-lg sm:text-xl font-semibold tabular-nums">—</p>
            </>
          )}
        </Panel>
      ))}
    </div>
  );
}