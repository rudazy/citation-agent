"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Bot, ChevronDown, Loader2, TrendingUp, User } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { fetchWithRetry } from "@/lib/client-fetch";
import { formatPaymentDate } from "@/lib/format-datetime";
import {
  DEMAND_WINDOWS,
  DEMAND_WINDOW_LABELS,
  type DemandWindow,
} from "@/lib/demand-surfaces";
import { SIGNAL_DIRECTION_LABELS, type SignalDirection } from "@/lib/signal-card";
import { ResolutionBadge } from "@/components/marketplace/resolution-badge";
import type {
  ResolutionStatus,
  SignalOutcome,
} from "@/lib/signal-resolution";
import { cn } from "@/lib/utils";

type DemandPayload = {
  window: DemandWindow;
  totals: {
    unlocks: number;
    agent_unlocks: number;
    human_unlocks: number;
    agent_share_pct: number;
    earned_usdc: string;
  };
  top_desks: Array<{
    username: string;
    unlocks: number;
    agent_unlocks: number;
    earned_usdc: string;
    profile_path: string;
  }>;
  rising_desks: Array<{
    username: string;
    window_unlocks: number;
    prior_unlocks: number;
    all_time_unlocks: number;
    growth: number;
    profile_path: string;
  }>;
  top_signals: Array<{
    post_id: string;
    title: string;
    author: string;
    unlocks: number;
    path: string;
  }>;
  recent_unlocks: Array<{
    post_id: string;
    title: string;
    author: string;
    post_kind: "research" | "signal";
    payer_kind: "agent" | "human";
    at: string;
    path: string;
  }>;
  conviction_changes: Array<{
    username: string;
    theme: string;
    from_direction: string;
    to_direction: string;
    to_post_id: string;
    to_title: string | null;
    changed_at: string;
    path: string;
    profile_path: string;
  }>;
  recent_resolutions: Array<{
    post_id: string;
    title: string;
    author: string;
    outcome: SignalOutcome;
    status: ResolutionStatus;
    resolved_at: string;
    path: string;
    profile_path: string;
  }>;
  resolutions_available: boolean;
};

function directionLabel(value: string): string {
  return SIGNAL_DIRECTION_LABELS[value as SignalDirection] ?? value;
}

function trimUsdc(value: string): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return n.toFixed(6).replace(/\.?0+$/, "") || "0";
}

/**
 * The daily/weekly reason to open the marketplace: who is buying, which desks
 * are winning, which are rising, and who changed their mind.
 */
export function DemandBoard() {
  const [expanded, setExpanded] = useState(false);
  const [window, setWindow] = useState<DemandWindow>("7d");
  const [data, setData] = useState<DemandPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (next: DemandWindow) => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(
        `/api/marketplace/demand?window=${next}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setData((await res.json()) as DemandPayload);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Lazy: the board aggregates the whole ledger, so it only loads once the
  // reader actually opens it (and again when they change window).
  useEffect(() => {
    if (!expanded) return;
    void load(window);
  }, [expanded, load, window]);

  const hasDemand = (data?.totals.unlocks ?? 0) > 0;

  const summary = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Unlocks", value: data.totals.unlocks.toLocaleString() },
      { label: "By agents", value: data.totals.agent_unlocks.toLocaleString() },
      { label: "By humans", value: data.totals.human_unlocks.toLocaleString() },
      { label: "Paid to desks", value: `$${trimUsdc(data.totals.earned_usdc)}` },
    ];
  }, [data]);

  // A demand board is a live surface; hiding it on a transient failure is
  // better than showing zeros that read as "nobody is buying".
  if (failed) return null;

  return (
    <Panel className="space-y-4 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
          <Activity size={18} className="text-[#f5c842]" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold tracking-wide">Demand</h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
            {expanded && data && data.totals.unlocks > 0
              ? `${data.totals.unlocks} unlocks ${DEMAND_WINDOW_LABELS[window].toLowerCase()} — ${data.totals.agent_share_pct}% from AI agents.`
              : "Who is buying right now — agent vs human demand, top and rising desks, conviction changes."}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "mt-1 shrink-0 text-[#888] transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[#1f1f1f] pt-4">
          <div className="flex rounded border border-[#1f1f1f] p-0.5 w-fit">
            {DEMAND_WINDOWS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setWindow(id)}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
                  window === id
                    ? "bg-[#f5c842]/15 text-[#f5c842]"
                    : "text-[#666] hover:text-[#aaa]",
                )}
              >
                {DEMAND_WINDOW_LABELS[id]}
              </button>
            ))}
          </div>

          {loading && !data ? (
        <div className="flex items-center gap-2 py-6 font-mono text-xs text-[#666]">
          <Loader2 size={14} className="animate-spin text-[#f5c842]" />
          Loading demand…
        </div>
      ) : !hasDemand ? (
        <p className="rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-6 text-center font-mono text-[11px] text-[#666]">
          No unlocks in this window yet. Demand appears here as humans and agents
          buy.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.map((stat) => (
              <div key={stat.label} className="space-y-0.5">
                <p className="font-mono text-[9px] uppercase tracking-wide text-[#555]">
                  {stat.label}
                </p>
                <p className="font-mono text-sm tabular-nums text-[#f5f5f5]">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {data && data.totals.unlocks > 0 && (
            <div className="space-y-1">
              <div className="flex h-1.5 overflow-hidden rounded bg-[#1f1f1f]">
                <div
                  className="bg-[#c8f135]"
                  style={{ width: `${data.totals.agent_share_pct}%` }}
                />
                <div className="flex-1 bg-[#f5c842]" />
              </div>
              <p className="font-mono text-[10px] text-[#666]">
                {data.totals.agent_share_pct}% of unlocks came from AI agents
              </p>
            </div>
          )}

          <div className="grid gap-4 border-t border-[#1f1f1f] pt-4 sm:grid-cols-2">
            <section className="space-y-2">
              <p className="font-mono text-[9px] uppercase tracking-wide text-[#555]">
                Top desks
              </p>
              {data?.top_desks.length ? (
                <ul className="space-y-1.5">
                  {data.top_desks.map((desk) => (
                    <li
                      key={desk.username}
                      className="flex items-center justify-between gap-2"
                    >
                      <Link
                        href={desk.profile_path}
                        className="truncate font-mono text-[11px] text-[#a3a3a3] hover:text-[#f5c842]"
                      >
                        @{desk.username}
                      </Link>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#666]">
                        {desk.unlocks} · ${trimUsdc(desk.earned_usdc)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-[10px] text-[#555]">No desks yet.</p>
              )}
            </section>

            <section className="space-y-2">
              <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-[#555]">
                <TrendingUp size={11} className="text-[#c8f135]" />
                Rising desks
              </p>
              {data?.rising_desks.length ? (
                <ul className="space-y-1.5">
                  {data.rising_desks.map((desk) => (
                    <li
                      key={desk.username}
                      className="flex items-center justify-between gap-2"
                    >
                      <Link
                        href={desk.profile_path}
                        className="truncate font-mono text-[11px] text-[#a3a3a3] hover:text-[#f5c842]"
                      >
                        @{desk.username}
                      </Link>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#666]">
                        {desk.prior_unlocks} → {desk.window_unlocks}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-[10px] text-[#555]">
                  No desk is accelerating in this window.
                </p>
              )}
            </section>
          </div>

          {data && data.top_signals.length > 0 && (
            <section className="space-y-2 border-t border-[#1f1f1f] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-wide text-[#555]">
                Top signals {DEMAND_WINDOW_LABELS[window].toLowerCase()}
              </p>
              <ul className="space-y-1.5">
                {data.top_signals.map((post) => (
                  <li key={post.post_id} className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#f5c842]">
                      {post.unlocks}
                    </span>
                    <Link
                      href={post.path}
                      className="truncate font-mono text-[11px] text-[#a3a3a3] hover:text-[#f5c842]"
                    >
                      {post.title}
                    </Link>
                    <span className="shrink-0 font-mono text-[10px] text-[#555]">
                      @{post.author}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.recent_resolutions?.length > 0 && (
            <section className="space-y-2 border-t border-[#1f1f1f] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-wide text-[#555]">
                Just resolved
              </p>
              <ul className="space-y-1.5">
                {data.recent_resolutions.map((row) => (
                  <li
                    key={row.post_id}
                    className="flex flex-wrap items-baseline gap-2"
                  >
                    <ResolutionBadge status={row.status} outcome={row.outcome} />
                    <Link
                      href={row.path}
                      className="truncate font-mono text-[11px] text-[#a3a3a3] hover:text-[#f5c842]"
                    >
                      {row.title}
                    </Link>
                    <Link
                      href={row.profile_path}
                      className="shrink-0 font-mono text-[10px] text-[#555] hover:text-[#f5c842]"
                    >
                      @{row.author}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.conviction_changes.length > 0 && (
            <section className="space-y-2 border-t border-[#1f1f1f] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-wide text-[#555]">
                Conviction changes
              </p>
              <ul className="space-y-1.5">
                {data.conviction_changes.map((change) => (
                  <li
                    key={`${change.username}-${change.theme}-${change.to_post_id}`}
                    className="font-mono text-[11px] leading-relaxed text-[#888]"
                  >
                    <Link
                      href={change.profile_path}
                      className="text-[#a3a3a3] hover:text-[#f5c842]"
                    >
                      @{change.username}
                    </Link>{" "}
                    flipped{" "}
                    <span className="text-[#666]">{change.theme}</span>{" "}
                    <span className="text-[#666]">
                      {directionLabel(change.from_direction)}
                    </span>{" "}
                    →{" "}
                    <Link
                      href={change.path}
                      className="text-[#c8f135] hover:underline"
                    >
                      {directionLabel(change.to_direction)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.recent_unlocks.length > 0 && (
            <section className="space-y-2 border-t border-[#1f1f1f] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-wide text-[#555]">
                Latest unlocks
              </p>
              <ul className="space-y-1.5">
                {data.recent_unlocks.slice(0, 8).map((row, i) => (
                  <li
                    key={`${row.post_id}-${row.at}-${i}`}
                    className="flex items-baseline gap-2"
                  >
                    {row.payer_kind === "agent" ? (
                      <Bot size={11} className="shrink-0 text-[#c8f135]" />
                    ) : (
                      <User size={11} className="shrink-0 text-[#f5c842]" />
                    )}
                    <Link
                      href={row.path}
                      className="truncate font-mono text-[11px] text-[#a3a3a3] hover:text-[#f5c842]"
                    >
                      {row.title}
                    </Link>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-[#555]">
                      {formatPaymentDate(row.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
