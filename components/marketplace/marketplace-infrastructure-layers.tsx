"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Bot, ChevronDown, Shield, TrendingUp } from "lucide-react";
import { AttestationRegistry } from "@/components/attest";
import { MarketplaceBuyer } from "@/components/marketplace/marketplace-buyer";
import { PaymentTrace } from "@/components/marketplace/payment-trace";
import { cn } from "@/lib/utils";

type LayerShellProps = {
  layer: number;
  title: string;
  summary: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function LayerShell({
  layer,
  title,
  summary,
  icon: Icon,
  accent,
  expanded,
  onToggle,
  children,
}: LayerShellProps) {
  return (
    <section
      className={cn(
        "panel-surface space-y-4 border-[#1f1f1f] p-4 sm:p-5 transition-colors",
        expanded && "border-[#2a2a2a]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 text-left"
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-[#111]",
            accent,
          )}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#555]">
            Layer {layer}
          </p>
          <h2 className="text-base font-semibold tracking-wide">{title}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
            {summary}
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
      {expanded && children}
    </section>
  );
}

type Props = {
  traceId: string;
  onTraceId: (id: string) => void;
};

export function MarketplaceInfrastructureLayers({ traceId, onTraceId }: Props) {
  const [reputationOpen, setReputationOpen] = useState(false);
  const [attestationsOpen, setAttestationsOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [traceOpen, setTraceOpen] = useState(false);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-[#1f1f1f] pt-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-wide text-[#a3a3a3]">
            How it works underneath
          </p>
          <p className="text-xs font-mono text-muted-foreground max-w-xl leading-relaxed">
            Reputation, research backing, agent wallets, and settlement tracing — the machinery
            that makes agent commerce defensible. Browse research first; explore layers when
            ready.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 text-xs font-mono text-[#f5c842] hover:underline"
        >
          Full dashboard →
        </Link>
      </div>

      <LayerShell
        layer={2}
        title="Researcher reputation"
        summary="Scores rank which reports surface first for agents. Verify a researcher on any card, or let the agent rank sources automatically."
        icon={TrendingUp}
        accent="border-[#f5c842]/30 text-[#f5c842]"
        expanded={reputationOpen}
        onToggle={() => setReputationOpen((v) => !v)}
      >
        <div className="space-y-3 font-mono text-xs text-[#888] leading-relaxed">
          <p>
            Research is the product. Reputation is why one report ranks above another —
            powered by behavioral scoring under the hood.
          </p>
          <p>
            On each catalog card: unlock to buy the report. Use{" "}
            <span className="text-[#f5c842]">Verify reputation</span> to resolve a
            researcher score (wallet hidden). Agents apply the same ranking when synthesizing
            answers.
          </p>
        </div>
      </LayerShell>

      <LayerShell
        layer={3}
        title="Research backing"
        summary="Back a report or researcher with USDC on-chain. Public registry shows who put money behind a source."
        icon={Shield}
        accent="border-[#f5c842]/25 text-[#f5c842]"
        expanded={attestationsOpen}
        onToggle={() => setAttestationsOpen((v) => !v)}
      >
        <AttestationRegistry />
      </LayerShell>

      <LayerShell
        layer={4}
        title="Agent mode"
        summary="Humans unlock with MetaMask. Agents unlock the same research automatically — fund a wallet, deposit to Circle Gateway, pay without a browser prompt."
        icon={Bot}
        accent="border-[#ff8a3d]/30 text-[#ff8a3d]"
        expanded={agentOpen}
        onToggle={() => setAgentOpen((v) => !v)}
      >
        <MarketplaceBuyer onSettlement={onTraceId} />
      </LayerShell>

      <LayerShell
        layer={5}
        title="Settlement trace"
        summary="Follow EIP-712 signatures through Circle Gateway to on-chain submitBatch — full payment lifecycle."
        icon={Activity}
        accent="border-[#ff8a3d]/25 text-[#ff8a3d]"
        expanded={traceOpen}
        onToggle={() => setTraceOpen((v) => !v)}
      >
        <PaymentTrace initialSettlementId={traceId} key={traceId} />
      </LayerShell>
    </div>
  );
}