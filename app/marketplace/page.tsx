"use client";

import { Suspense, useState } from "react";
import { CreatorPublishPanel } from "@/components/marketplace/creator-publish-panel";
import { FollowingFeedPanel } from "@/components/marketplace/following-feed-panel";
import { MarketplaceCitations } from "@/components/marketplace/marketplace-citations";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { MarketplaceStats } from "@/components/marketplace/marketplace-stats";
import { MarketplaceInfrastructureLayers } from "@/components/marketplace/marketplace-infrastructure-layers";
import { SignalPublishPanel } from "@/components/marketplace/signal-publish-panel";
import { DEMO_SETTLEMENT_ID } from "@/lib/marketplace";

export default function MarketplacePage() {
  const [traceId, setTraceId] = useState(DEMO_SETTLEMENT_ID);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  return (
    <div className="mx-auto max-w-4xl w-full min-w-0 space-y-6 sm:space-y-8">
      <MarketplaceHero />

      <MarketplaceStats />

      <div id="publish-signal" className="scroll-mt-24">
        <SignalPublishPanel onPublished={() => setCatalogRefresh((n) => n + 1)} />
      </div>

      <CreatorPublishPanel onPublished={() => setCatalogRefresh((n) => n + 1)} />

      <Suspense fallback={null}>
        <MarketplaceCitations refreshKey={catalogRefresh} />
      </Suspense>

      {/* Feed only — discovery is hero Follow (not mid-page) */}
      <FollowingFeedPanel />

      <MarketplaceInfrastructureLayers traceId={traceId} onTraceId={setTraceId} />
    </div>
  );
}