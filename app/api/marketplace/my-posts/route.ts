import { NextResponse } from "next/server";
import { resolveTrustIdentityWallet } from "@/lib/catalog-identity";
import { trustScoreToSignal } from "@/lib/creator-trust";
import { loadPublishedPostsByConnectedWallet } from "@/lib/creator-posts";
import {
  fetchCitationLedgerStats,
  getCitationLedgerStats,
} from "@/lib/catalog-earnings-stats";
import { getViewStatsForPosts } from "@/lib/post-views";
import { verifyMyPostsRequest } from "@/lib/publisher-auth";
import { getTrustScores } from "@/lib/trustgate";
import { getProfileByWallet } from "@/lib/platform-profile";
import {
  EMPTY_CURATOR_CREDIT,
  getCuratorCreditSummary,
} from "@/lib/unlock-attribution";
import { getEndorsementSummariesForPosts } from "@/lib/endorsements";

/**
 * GET — list posts published by the signed wallet (no bodies, no private keys).
 */
export async function GET(request: Request) {
  const wallet = await verifyMyPostsRequest(request);
  if (!wallet) {
    return NextResponse.json(
      { error: "Connect your wallet and sign to view your published posts" },
      { status: 401 },
    );
  }

  const posts = await loadPublishedPostsByConnectedWallet(wallet);
  if (posts.length === 0) {
    return NextResponse.json({ count: 0, posts: [] });
  }

  const citationIds = posts.map((p) => p.id);
  const payoutWallets = posts.map((p) => p.payoutWallet);

  const publisherTrustWallet = wallet.toLowerCase();
  const publisherProfile = await getProfileByWallet(wallet);

  const [
    scores,
    ledgerStats,
    publisherScore,
    viewStats,
    endorsementIndex,
    curatorCredit,
  ] = await Promise.all([
    getTrustScores(posts.map((p) => resolveTrustIdentityWallet(p))),
    fetchCitationLedgerStats(citationIds, payoutWallets),
    getTrustScores([wallet]),
    getViewStatsForPosts(citationIds),
    getEndorsementSummariesForPosts(citationIds),
    publisherProfile
      ? getCuratorCreditSummary(publisherProfile.id)
      : Promise.resolve(EMPTY_CURATOR_CREDIT),
  ]);

  const items = posts.map((post) => {
    const ledger = getCitationLedgerStats(ledgerStats, post.id);
    const paidCount = Math.max(post.paidCount, ledger.allTimeReaders);
    const trustWallet = resolveTrustIdentityWallet(post);
    const views = viewStats.get(post.id);
    const viewsTotal = views?.viewsTotal ?? 0;
    return {
      id: post.id,
      title: post.title,
      author: post.author,
      price_usdc: post.priceUsdc,
      tags: post.tags,
      subheading: post.subheading,
      paid_count: paidCount,
      recent_readers_7d: ledger.recentReaders7d,
      post_earnings_usdc: ledger.postEarningsUsdc,
      published_at: post.publishedAt,
      cover_image_url: post.coverImageUrl ?? null,
      edit_version: post.editVersion ?? 1,
      views_total: viewsTotal,
      views_7d: views?.views7d ?? 0,
      // Teaser-to-unlock conversion; null until the post has views.
      unlock_conversion: viewsTotal > 0 ? Number((paidCount / viewsTotal).toFixed(4)) : null,
      top_referrers: views?.topReferrers ?? [],
      endorsement_count: endorsementIndex.get(post.id)?.count ?? 0,
      endorsed_by: endorsementIndex.get(post.id)?.topEndorsers ?? [],
      endpoint: `/api/marketplace/citations?id=${post.id}`,
      post_kind: post.postKind ?? "research",
      signal_direction: post.signalDirection ?? null,
      signal_confidence: post.signalConfidence ?? null,
      signal_horizon: post.signalHorizon ?? null,
      trust: trustScoreToSignal(
        scores.get(trustWallet.toLowerCase()) ?? null,
        "free",
        post.id,
      ),
    };
  });

  const desk = {
    research_count: items.filter((p) => p.post_kind !== "signal").length,
    signal_count: items.filter((p) => p.post_kind === "signal").length,
    total_views: items.reduce((sum, p) => sum + (p.views_total ?? 0), 0),
    total_unlocks: items.reduce((sum, p) => sum + (p.paid_count ?? 0), 0),
    total_earnings_usdc: Number(
      items
        .reduce((sum, p) => sum + (Number(p.post_earnings_usdc) || 0), 0)
        .toFixed(6),
    ),
    endorsements_received: items.reduce(
      (sum, p) => sum + (p.endorsement_count ?? 0),
      0,
    ),
    // Curator side of the desk: unlocks this desk routed for other creators.
    // Credit accrues off-chain and is not yet settled on Arc.
    attributed_unlocks: curatorCredit.attributedUnlocks,
    curator_credit_pending_usdc: curatorCredit.pendingCreditUsdc,
    curator_credit_total_usdc: curatorCredit.totalCreditUsdc,
    curator_endorsement_unlocks: curatorCredit.endorsementUnlocks,
    curator_referral_unlocks: curatorCredit.referralUnlocks,
  };

  return NextResponse.json({
    count: items.length,
    posts: items,
    desk,
    publisher_wallet: wallet,
    publisher_trust: trustScoreToSignal(
      publisherScore.get(publisherTrustWallet) ?? null,
      "free",
    ),
  });
}