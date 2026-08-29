"use client";

import { Suspense, useState } from "react";
import { CreatorPublishPanel } from "@/components/marketplace/creator-publish-panel";
import { DemandBoard } from "@/components/marketplace/demand-board";
import { FollowingFeedPanel } from "@/components/marketplace/following-feed-panel";
import { SectorLanes } from "@/components/marketplace/sector-lanes";
import { MarketplaceCitations } from "@/components/marketplace/marketplace-citations";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { MarketplaceStats } from "@/components/marketplace/marketplace-stats";
import { MarketplaceInfrastructureLayers } from "@/components/marketplace/marketplace-infrastructure-layers";
import { ReferralCapture } from "@/components/marketplace/referral-capture";
import { SignalPublishPanel } from "@/components/marketplace/signal-publish-panel";
import { DEMO_SETTLEMENT_ID } from "@/lib/marketplace";

export default function MarketplacePage() {
  const [traceId, setTraceId] = useState(DEMO_SETTLEMENT_ID);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  // Edge-to-edge shell — <main> supplies the gutters. Nothing here caps width;
  // article prose holds its own readable measure (see .citation-body-markdown).
  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>

      <MarketplaceHero />

      <MarketplaceStats />

      {/* Publish first: signal (the fast first win), then long-form research. */}
      <div id="publish-signal" className="scroll-mt-24">
        <SignalPublishPanel onPublished={() => setCatalogRefresh((n) => n + 1)} />
      </div>

      <CreatorPublishPanel onPublished={() => setCatalogRefresh((n) => n + 1)} />

      {/* Catalog heads the browse group; Demand and niche follow as dropdowns. */}
      <Suspense fallback={null}>
        <MarketplaceCitations refreshKey={catalogRefresh} />
      </Suspense>

      {/* Daily reason to return: who bought, which desks are winning/rising. */}
      <DemandBoard />

      <Suspense fallback={null}>
        <SectorLanes />
      </Suspense>

      {/* Feed only — discovery is hero Follow (not mid-page) */}
      <FollowingFeedPanel />

      <MarketplaceInfrastructureLayers traceId={traceId} onTraceId={setTraceId} />
    </div>
  );
}