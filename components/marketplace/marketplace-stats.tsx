"use client";

import { useEffect, useState } from "react";

type MarketplaceMetrics = {
  creatorsPublishing: number;
  reportsAvailable: number;
  unlocksSinceLaunch: number;
  paidToCreatorsUsdc: string;
  campaignStart: string;
};

type Stat = { label: string; value: string; muted?: boolean };

function buildStats(m: MarketplaceMetrics): Stat[] {
  const launched = m.unlocksSinceLaunch > 0;
  const paid = parseFloat(m.paidToCreatorsUsdc) > 0;
  return [
    { label: "Creators publishing", value: m.creatorsPublishing.toLocaleString() },
    { label: "Reports available", value: m.reportsAvailable.toLocaleString() },
    {
      label: "Unlocks since launch",
      value: launched ? m.unlocksSinceLaunch.toLocaleString() : "Just launched",
      muted: !launched,
    },
    {
      label: "Paid to creators",
      value: paid ? `${m.paidToCreatorsUsdc} USDC` : "Just launched",
      muted: !paid,
    },
  ];
}

export function MarketplaceStats() {
  const [metrics, setMetrics] = useState<MarketplaceMetrics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/marketplace/metrics", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as MarketplaceMetrics;
        if (active) setMetrics(data);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Stay invisible if the metrics endpoint is unavailable: never show a broken strip.
  if (failed) return null;

  const stats = metrics ? buildStats(metrics) : null;

  return (
    <section
      aria-label="Marketplace activity"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
    >
      {(stats ?? Array.from({ length: 4 })).map((stat, i) => (
        <div
          key={stats ? (stat as Stat).label : i}
          className="rounded border border-[#1f1f1f] bg-[#111] px-4 py-3"
        >
          {stats ? (
            <>
              <p
                className={`font-mono text-lg sm:text-xl font-semibold tracking-wide ${
                  (stat as Stat).muted ? "text-[#666]" : "text-[#f5c842]"
                }`}
              >
                {(stat as Stat).value}
              </p>
              <p className="mt-1 text-xs text-[#666] font-mono">{(stat as Stat).label}</p>
            </>
          ) : (
            <>
              <div className="h-6 w-12 animate-pulse rounded bg-[#1f1f1f]" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[#1f1f1f]" />
            </>
          )}
        </div>
      ))}
    </section>
  );
}
