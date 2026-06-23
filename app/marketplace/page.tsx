"use client";

import { useState } from "react";
import { CreatorPublishPanel } from "@/components/marketplace/creator-publish-panel";
import { MarketplaceBuyer } from "@/components/marketplace/marketplace-buyer";
import { MarketplaceCitations } from "@/components/marketplace/marketplace-citations";
import { AttestationRegistry } from "@/components/attest";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { PaymentTrace } from "@/components/marketplace/payment-trace";
import { DEMO_SETTLEMENT_ID } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { Activity, ChevronDown } from "lucide-react";

export default function MarketplacePage() {
  const [traceId, setTraceId] = useState(DEMO_SETTLEMENT_ID);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [traceExpanded, setTraceExpanded] = useState(false);

  return (
    <div className="mx-auto max-w-4xl w-full min-w-0 space-y-6 sm:space-y-8">
      <MarketplaceHero />

      <CreatorPublishPanel onPublished={() => setCatalogRefresh((n) => n + 1)} />

      <MarketplaceBuyer onSettlement={setTraceId} />

      <MarketplaceCitations refreshKey={catalogRefresh} />

      <AttestationRegistry />

      <section className="panel-surface panel-glow space-y-4 border-[#ff8a3d]/25 bg-gradient-to-b from-[#ff8a3d]/8 to-transparent p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setTraceExpanded((v) => !v)}
          aria-expanded={traceExpanded}
          className="flex w-full items-start gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#ff8a3d]/30 bg-[#ff8a3d]/10">
            <Activity size={18} className="text-[#ff8a3d]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold tracking-wide">Payment trace</h2>
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">
              Six-step settlement lifecycle: EIP-712 signature, Circle facilitator,
              queued settlement, relayer batch, on-chain <code>submitBatch</code>, completed.
              Paste any settlement UUID or pay above to generate a fresh trace.
            </p>
          </div>
          <ChevronDown
            size={18}
            className={cn(
              "mt-1 shrink-0 text-[#888] transition-transform",
              traceExpanded && "rotate-180",
            )}
          />
        </button>
        <div className={cn(!traceExpanded && "hidden")}>
          <PaymentTrace initialSettlementId={traceId} key={traceId} />
        </div>
      </section>
    </div>
  );
}