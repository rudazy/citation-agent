"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Bot,
  ChevronRight,
  ExternalLink,
  Globe,
  Hash,
  Linkedin,
  Loader2,
  RefreshCw,
  Shield,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AttestModal } from "./AttestModal";
import { AttestTrigger } from "./attest-trigger";
import type { TargetKind } from "@/lib/attestation-client";

const EXPLORER = "https://testnet.arcscan.app/tx/";

type TargetSummary = {
  target: string;
  label: string;
  kind: TargetKind;
  totalUsdc: string;
  claimCount: number;
};

type TargetClaim = {
  target: string;
  claim: string;
  amountUsdc: string;
  staker: `0x${string}`;
  timestamp: number;
  txHash: `0x${string}` | null;
};

type TargetDetail = {
  target: string;
  label: string;
  kind: TargetKind;
  totalUsdc: string;
  claims: TargetClaim[];
};

const KIND_META: Record<TargetKind, { label: string; icon: LucideIcon; accent: string }> = {
  wallet: { label: "Wallet", icon: Wallet, accent: "text-[#f5c842]" },
  website: { label: "Website", icon: Globe, accent: "text-[#ff8a3d]" },
  social: { label: "X Account", icon: AtSign, accent: "text-[#c8f135]" },
  linkedin: { label: "LinkedIn", icon: Linkedin, accent: "text-[#f5c842]" },
  agent: { label: "Agent", icon: Bot, accent: "text-[#ff8a3d]" },
  other: { label: "Custom", icon: Hash, accent: "text-[#a3a3a3]" },
};

function formatWhen(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function displayTarget(target: string, kind: TargetKind): string {
  if (kind === "social" && target.startsWith("x:@")) return target.slice(2);
  if (kind === "agent" && target.startsWith("agent:")) return target.slice(6);
  return target;
}

function TargetRow({
  row,
  active,
  onSelect,
}: {
  row: TargetSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = KIND_META[row.kind];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded border px-3 py-3.5 sm:py-3 text-left transition-colors active:scale-[0.99]",
        "min-h-[4.25rem] touch-manipulation",
        active
          ? "border-[#ff8a3d]/45 bg-[#ff8a3d]/10"
          : "border-[#1f1f1f] bg-[#111] hover:border-[#333]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded border border-[#2a2a2a] bg-[#141414]">
          <Icon size={16} className={meta.accent} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-base sm:text-sm font-medium text-[#f5f5f5]">
            {displayTarget(row.target, row.kind)}
          </p>
          <p className="text-[11px] sm:text-[10px] text-muted-foreground font-mono">
            {meta.label} · {row.claimCount} claim{row.claimCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-base sm:text-sm font-semibold text-[#ff8a3d] tabular-nums">
            {row.totalUsdc}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">USDC</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground shrink-0 lg:hidden" />
      </div>
    </button>
  );
}

function ClaimCard({ claim }: { claim: TargetClaim }) {
  return (
    <article className="rounded border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden touch-manipulation">
      <div className="flex items-center justify-between gap-2 border-b border-[#1f1f1f] bg-[#141414]/60 px-3.5 py-2.5">
        <span className="font-mono text-sm font-semibold text-[#f5c842] tabular-nums">
          {claim.amountUsdc} USDC
        </span>
        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
          {formatWhen(claim.timestamp)}
        </span>
      </div>
      <div className="space-y-2 px-3.5 py-3">
        <p className="text-[10px] uppercase tracking-wider text-[#666] font-mono">Why they staked</p>
        <p className="font-mono text-sm sm:text-base text-[#f5f5f5] leading-relaxed">{claim.claim}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-muted-foreground">
          <span>
            {claim.staker.slice(0, 6)}…{claim.staker.slice(-4)}
          </span>
          {claim.txHash && (
            <a
              href={`${EXPLORER}${claim.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-[#ff8a3d]/30 px-2 py-1 text-[#ff8a3d] hover:bg-[#ff8a3d]/10"
            >
              Arcscan
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function DetailPanel({
  detail,
  detailLoading,
  detailError,
  selectedTarget,
  onBack,
  onRetry,
  onAttest,
}: {
  detail: TargetDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  selectedTarget: string;
  onBack: () => void;
  onRetry: () => void;
  onAttest: (target: string) => void;
}) {
  const selectedMeta = detail ? KIND_META[detail.kind] : null;
  const SelectedIcon = selectedMeta?.icon ?? Shield;

  return (
    <div className="flex flex-col min-h-0 lg:rounded lg:border lg:border-[#1f1f1f] lg:bg-[#111] lg:p-4 lg:min-h-[280px]">
      <div className="flex items-center gap-2 mb-3 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-10 shrink-0 p-0 text-[#f5f5f5] hover:bg-[#141414]"
          onClick={onBack}
          aria-label="Back to targets"
        >
          <ArrowLeft size={18} />
        </Button>
        <p className="font-mono text-sm font-medium truncate">
          {detail ? displayTarget(detail.target, detail.kind) : "Claims"}
        </p>
      </div>

      {!selectedTarget && (
        <p className="py-16 text-center font-mono text-xs text-muted-foreground max-lg:hidden">
          Select a target to view all claims and stakes
        </p>
      )}

      {selectedTarget && detailLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground font-mono">
          <Loader2 size={14} className="animate-spin" />
          Loading claims…
        </div>
      )}

      {selectedTarget && !detailLoading && detailError && (
        <div className="space-y-3 py-8 text-center">
          <p className="font-mono text-xs text-destructive px-4">{detailError}</p>
          <Button type="button" size="sm" variant="outline" className="border-[#333]" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {selectedTarget && !detailLoading && !detailError && detail && detail.claims.length === 0 && (
        <div className="space-y-3 py-12 text-center px-4">
          <p className="font-mono text-xs text-muted-foreground">
            No public claims indexed for {displayTarget(detail.target, detail.kind)} yet.
          </p>
          <Button type="button" size="sm" variant="outline" className="border-[#333]" onClick={onRetry}>
            Refresh
          </Button>
        </div>
      )}

      {selectedTarget && !detailLoading && !detailError && detail && detail.claims.length > 0 && (
        <div className="space-y-4 animate-fade-up flex-1 min-h-0 flex flex-col">
          <div className="hidden lg:flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#2a2a2a] bg-[#141414]">
                <SelectedIcon size={14} className={selectedMeta?.accent} />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-sm text-[#f5f5f5] break-all">
                  {displayTarget(detail.target, detail.kind)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                  {selectedMeta?.label} · {detail.claims.length} on-chain
                </p>
              </div>
            </div>
            <Badge className="bg-[#ff8a3d]/10 text-[#ff8a3d] border border-[#ff8a3d]/25 hover:bg-[#ff8a3d]/10 font-mono">
              {detail.totalUsdc} USDC staked
            </Badge>
          </div>

          <div className="lg:hidden rounded-lg border border-[#ff8a3d]/25 bg-gradient-to-br from-[#ff8a3d]/12 via-[#111] to-[#0a0a0a] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[#ff8a3d]/30 bg-[#ff8a3d]/10">
                <SelectedIcon size={18} className={selectedMeta?.accent} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-lg font-semibold text-[#f5f5f5] break-all">
                  {displayTarget(detail.target, detail.kind)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  {selectedMeta?.label} · {detail.claims.length} public claim
                  {detail.claims.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <p className="mt-4 font-mono text-2xl font-semibold tabular-nums text-[#ff8a3d]">
              {detail.totalUsdc}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">USDC staked</span>
            </p>
          </div>

          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-0.5">
            What stakers claimed publicly
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto pr-0.5 max-h-none lg:max-h-[360px] pb-2">
            {detail.claims.map((claim, index) => (
              <ClaimCard key={`${claim.timestamp}-${index}`} claim={claim} />
            ))}
          </div>

          <div className="sticky bottom-0 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:static lg:pb-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent lg:bg-none">
            <Button
              type="button"
              size="default"
              className="w-full h-11 bg-[#ff8a3d] text-[#0a0a0a] hover:bg-[#ff8a3d]/90 lg:w-auto lg:h-9 lg:bg-transparent lg:text-[#ff8a3d] lg:border lg:border-[#ff8a3d]/35 lg:hover:bg-[#ff8a3d]/10"
              variant="default"
              onClick={() => onAttest(detail.target)}
            >
              <Shield size={14} />
              Stake another claim
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AttestationRegistry({ className }: { className?: string }) {
  const [targets, setTargets] = useState<TargetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [detail, setDetail] = useState<TargetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [attestOpen, setAttestOpen] = useState(false);
  const [attestSeed, setAttestSeed] = useState("");

  const totals = useMemo(() => {
    const usdc = targets.reduce((sum, row) => sum + parseFloat(row.totalUsdc || "0"), 0);
    const claims = targets.reduce((sum, row) => sum + row.claimCount, 0);
    return { usdc: usdc.toFixed(usdc % 1 === 0 ? 0 : 2), claims, targets: targets.length };
  }, [targets]);

  const loadTargets = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const qs = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/attestation/claims${qs}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load (${res.status})`);
      }
      const data = (await res.json()) as { targets?: TargetSummary[] };
      setTargets(data.targets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attestations");
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (target: string, refresh = false) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const refreshQs = refresh ? "&refresh=1" : "";
      const res = await fetch(
        `/api/attestation/claims?target=${encodeURIComponent(target)}${refreshQs}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load target (${res.status})`);
      }
      const data = (await res.json()) as TargetDetail;
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setDetailError(err instanceof Error ? err.message : "Failed to load claims");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  const openTarget = (target: string) => {
    setSelectedTarget(target);
    void loadDetail(target);
  };

  const closeDetail = () => {
    setSelectedTarget(null);
    setDetail(null);
    setDetailError(null);
  };

  const openAttest = (target: string) => {
    const seed =
      target.startsWith("x:@") ? target.slice(2) : target.startsWith("agent:") ? target : target;
    setAttestSeed(seed);
    setAttestOpen(true);
  };

  const handleAttestSuccess = () => {
    void loadTargets(true);
    if (selectedTarget) void loadDetail(selectedTarget, true);
  };

  const refreshAll = () => {
    void loadTargets(true);
    if (selectedTarget) void loadDetail(selectedTarget, true);
  };

  return (
    <>
      <Panel glow className={cn("space-y-4 p-3 sm:p-5 border-[#ff8a3d]/20", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded border border-[#ff8a3d]/30 bg-[#ff8a3d]/10">
              <Shield size={20} className="text-[#ff8a3d]" />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg sm:text-lg font-semibold tracking-wide">On-chain claims</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
                Tap a target to see every public stake and why.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 border-[#333] text-[#888] hover:text-[#ccc] touch-manipulation"
              onClick={refreshAll}
              disabled={loading || detailLoading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <AttestTrigger
              target="@trustgated"
              onAttest={openAttest}
              label="New claim"
              variant="outline"
              size="sm"
              className="h-10 border-[#ff8a3d]/35 touch-manipulation"
            />
          </div>
        </div>

        {!loading && targets.length > 0 && (
          <div className="grid grid-cols-3 gap-2 lg:hidden">
            {[
              { label: "Targets", value: String(totals.targets) },
              { label: "Claims", value: String(totals.claims) },
              { label: "Staked", value: `${totals.usdc}` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded border border-[#1f1f1f] bg-[#111] px-2.5 py-2.5 text-center"
              >
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
                  {stat.label}
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#f5f5f5]">
                  {stat.value}
                  {stat.label === "Staked" && (
                    <span className="ml-0.5 text-[10px] font-normal text-[#ff8a3d]">U</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground font-mono">
            <Loader2 size={16} className="animate-spin text-[#ff8a3d]" />
            Indexing attestations from Arc…
          </div>
        )}

        {error && (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && targets.length === 0 && (
          <p className="py-8 text-center font-mono text-sm text-muted-foreground px-4">
            No attestations yet. Stake the first claim on @trustgated.
          </p>
        )}

        {!loading && targets.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            <div className={cn("space-y-2", selectedTarget && "max-lg:hidden")}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-0.5">
                Targets by total stake
              </p>
              <div className="space-y-2 max-h-none lg:max-h-[420px] lg:overflow-y-auto lg:pr-1">
                {targets.map((row) => (
                  <TargetRow
                    key={row.target}
                    row={row}
                    active={selectedTarget === row.target}
                    onSelect={() => openTarget(row.target)}
                  />
                ))}
              </div>
            </div>

            <div className={cn(!selectedTarget && "max-lg:hidden")}>
              {selectedTarget ? (
                <DetailPanel
                  detail={detail}
                  detailLoading={detailLoading}
                  detailError={detailError}
                  selectedTarget={selectedTarget}
                  onBack={closeDetail}
                  onRetry={() => void loadDetail(selectedTarget, true)}
                  onAttest={openAttest}
                />
              ) : (
                <DetailPanel
                  detail={null}
                  detailLoading={false}
                  detailError={null}
                  selectedTarget=""
                  onBack={closeDetail}
                  onRetry={() => {}}
                  onAttest={openAttest}
                />
              )}
            </div>
          </div>
        )}
      </Panel>

      <AttestModal
        isOpen={attestOpen}
        onClose={() => setAttestOpen(false)}
        target={attestSeed}
        onSuccess={handleAttestSuccess}
      />
    </>
  );
}