"use client";

import { useState } from "react";
import { MarketplaceBuyer } from "@/components/marketplace/marketplace-buyer";
import { PaymentTrace } from "@/components/marketplace/payment-trace";
import { DEMO_SETTLEMENT_ID } from "@/lib/marketplace";
import { Badge } from "@/components/ui/badge";

export default function MarketplacePage() {
  const [traceId, setTraceId] = useState(DEMO_SETTLEMENT_ID);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-wide">Citation Marketplace</h1>
          <Badge variant="outline">x402 + cUSDC</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Paywalled citation listings for research agents. Circle Gateway nanopayments on Arc
          Testnet with full settlement trace visibility.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Listings</h2>
        <p className="text-sm text-muted-foreground">
          Free catalog: <code className="rounded bg-muted px-1.5 py-0.5">GET /api/marketplace/citations</code>
          <br />
          Paid purchase:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            GET /api/marketplace/citations?id=&lt;listing-id&gt;
          </code>
        </p>
      </section>

      <MarketplaceBuyer onSettlement={setTraceId} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payment trace</h2>
        <p className="text-sm text-muted-foreground">
          Six-step lifecycle from EIP-712 signature through on-chain <code>submitBatch</code>.
          Pre-loaded with a demo settlement; updates after a live payment above.
        </p>
        <PaymentTrace initialSettlementId={traceId} key={traceId} />
      </section>
    </div>
  );
}