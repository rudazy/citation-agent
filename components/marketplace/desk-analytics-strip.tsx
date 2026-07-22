"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cacheMyPostsAuth } from "@/lib/my-posts-auth-cache";
import { myPostsHeaders, signMyPostsAuth } from "@/lib/publish-client";
import {
  getAuthorizedAccount,
  getEthereumProvider,
} from "@/lib/wallet-connection-client";

type DeskStats = {
  research_count: number;
  signal_count: number;
  total_views: number;
  total_unlocks: number;
  total_earnings_usdc: number;
};

/**
 * Owner-only desk analytics v1 — rollup from my-posts (unlocks, revenue, mix).
 */
export function DeskAnalyticsStrip({ className }: { className?: string }) {
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = await getEthereumProvider();
      const account = provider ? await getAuthorizedAccount(provider) : null;
      if (!provider || !account) {
        setError("Connect your publish wallet to load desk analytics");
        setStats(null);
        return;
      }
      const auth = await signMyPostsAuth(provider, account);
      cacheMyPostsAuth(auth);
      const res = await fetch("/api/marketplace/my-posts", {
        headers: myPostsHeaders(auth),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as { desk?: DeskStats };
      setStats(
        data.desk ?? {
          research_count: 0,
          signal_count: 0,
          total_views: 0,
          total_unlocks: 0,
          total_earnings_usdc: 0,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Lazy: owner clicks load (avoids wallet popup on every profile visit).
  }, []);

  return (
    <div
      className={
        className ??
        "space-y-3 rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={14} className="text-[#f5c842]" />
          <p className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
            Desk analytics
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
          className="h-7 border-[#333] font-mono text-[10px]"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : stats ? (
            "Refresh"
          ) : (
            "Load (sign once)"
          )}
        </Button>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-[#666]">
        Unlocks, revenue, and research vs signal mix for your desk.
      </p>
      {error && (
        <p className="font-mono text-[10px] text-[#c8a050]">{error}</p>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["Research", stats.research_count],
              ["Signals", stats.signal_count],
              ["Views", stats.total_views],
              ["Unlocks", stats.total_unlocks],
              ["Earned", `$${stats.total_earnings_usdc}`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <p className="font-mono text-[9px] uppercase tracking-wide text-[#555]">
                {label}
              </p>
              <p className="font-mono text-sm tabular-nums text-[#f5f5f5]">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
