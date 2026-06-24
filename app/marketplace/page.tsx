"use client";

import { useState } from "react";
import { CreatorPublishPanel } from "@/components/marketplace/creator-publish-panel";
import { MarketplaceCitations } from "@/components/marketplace/marketplace-citations";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { MarketplaceInfrastructureLayers } from "@/components/marketplace/marketplace-infrastructure-layers";
import { DEMO_SETTLEMENT_ID } from "@/lib/marketplace";

export default function MarketplacePage() {
  const [traceId, setTraceId] = useState(DEMO_SETTLEMENT_ID);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  return (
    <div className="mx-auto max-w-4xl w-full min-w-0 space-y-6 sm:space-y-8">
      <MarketplaceHero />

      <CreatorPublishPanel onPublished={() => setCatalogRefresh((n) => n + 1)} />

      <MarketplaceCitations refreshKey={catalogRefresh} />

      <MarketplaceInfrastructureLayers traceId={traceId} onTraceId={setTraceId} />
    </div>
  );
}