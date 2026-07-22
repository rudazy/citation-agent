import { NextRequest, NextResponse } from "next/server";
import { getCreatorContentById, loadAllCreatorContent, resolveUnlockPayee } from "@/lib/citations";
import { filterPublicResearchCatalog } from "@/lib/catalog-filter";
import { resolveTrustIdentityWallet } from "@/lib/catalog-identity";
import {
  incrementPostPaidCount,
  insertPublishedPost,
  updatePublishedPost,
} from "@/lib/creator-posts";
import { recordCitationRoyalty } from "@/lib/royalties";
import { formatCitationPaymentMemo } from "@/lib/payment-memo";
import { publishPayloadFromBody } from "@/lib/publish-payload";
import { verifyPublishRequest } from "@/lib/publish-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { isPaidTrustLookupAvailable, trustScoreToSignal } from "@/lib/creator-trust";
import {
  getBackingSummariesForTargets,
  invalidateAttestationCache,
} from "@/lib/attestation-index";
import {
  fetchCitationLedgerStats,
  getCitationLedgerStats,
  getCreatorEarningsUsdc,
  type CitationLedgerIndex,
} from "@/lib/catalog-earnings-stats";
import {
  getCreatorOwnedPostIds,
  isCreatorOwnedPost,
} from "@/lib/citation-creator-access";
import { getPriorUnlockIds } from "@/lib/citation-prior-unlock";
import { resolveCitationViewerWallets } from "@/lib/citation-viewer-wallets";
import {
  authorBackingTarget,
  indexBackingSummaries,
  reportBackingTarget,
  type ResearchBackingStats,
} from "@/lib/research-backing";
import {
  getProfilePayoutWallet,
  requirePublisherUsername,
  setProfilePayoutWallet,
} from "@/lib/platform-profile";
import { resolvePublishPayout } from "@/lib/publish-payout";
import { getCommentCountsForPosts } from "@/lib/post-comments";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { ensurePublisherLinkedToSession } from "@/lib/publisher-session-link";
import { getTrustScores, type TrustScore } from "@/lib/trustgate";
import { withGateway, type GatewayContext } from "@/lib/x402";
import type { CreatorContent } from "@/lib/citations";

/** Allow slower enrichment on Pro; still race-capped in the handler. */
export const maxDuration = 60;

function buildCitationUnlockResponse(content: CreatorContent, settledToCreator: boolean) {
  const canteenAddress = process.env.CANTEEN_USDC_ADDRESS ?? null;
  const paymentMemo = formatCitationPaymentMemo(content.id, content.author);

  return NextResponse.json({
    marketplace: {
      listing_id: content.id,
      token: canteenAddress ? "cUSDC" : "USDC",
      canteen_usdc_address: canteenAddress,
    },
    citation: {
      id: content.id,
      title: content.title,
      author: content.author,
      price_usdc: content.priceUsdc,
      tags: content.tags,
      subheading: content.subheading,
      body: content.body,
      royalty_split: settledToCreator
        ? { creator_share: "100%", platform_share: "0%" }
        : { creator_share: "0%", platform_share: "100%" },
    },
    attribution: settledToCreator
      ? "Paid marketplace citation — full amount settled on-chain to the creator payout wallet."
      : "Paid marketplace citation — settled to the platform operator wallet (legacy seed without a payout wallet).",
    payment_memo: paymentMemo,
    arc_memo_contract: "0x5294E9927c3306DcBaDb03fe70b92e01cCede505",
    timestamp: new Date().toISOString(),
  });
}

function creatorAccessAttribution(): string {
  return "Publisher access — you created this post; no unlock payment required.";
}

function buildCreatorCitationAccessResponse(content: CreatorContent) {
  const payTo = resolveUnlockPayee(content);
  const settledToCreator =
    payTo !== null && payTo.toLowerCase() === content.payoutWallet.toLowerCase();
  const canteenAddress = process.env.CANTEEN_USDC_ADDRESS ?? null;
  const paymentMemo = formatCitationPaymentMemo(content.id, content.author);

  return NextResponse.json({
    marketplace: {
      listing_id: content.id,
      token: canteenAddress ? "cUSDC" : "USDC",
      canteen_usdc_address: canteenAddress,
    },
    citation: {
      id: content.id,
      title: content.title,
      author: content.author,
      price_usdc: content.priceUsdc,
      tags: content.tags,
      subheading: content.subheading,
      body: content.body,
      royalty_split: settledToCreator
        ? { creator_share: "100%", platform_share: "0%" }
        : { creator_share: "0%", platform_share: "100%" },
    },
    attribution: creatorAccessAttribution(),
    payment_memo: paymentMemo,
    arc_memo_contract: "0x5294E9927c3306DcBaDb03fe70b92e01cCede505",
    timestamp: new Date().toISOString(),
  });
}

const paidHandler = async (req: NextRequest, ctx: GatewayContext) => {
  const id = req.nextUrl.searchParams.get("id");
  const query = req.nextUrl.searchParams.get("query") ?? undefined;

  if (!id) {
    return NextResponse.json(
      { error: "Missing citation id. Use ?id=<citation-id>" },
      { status: 400 },
    );
  }

  const content = await getCreatorContentById(id);
  if (!content) {
    return NextResponse.json({ error: `Citation not found: ${id}` }, { status: 404 });
  }

  const paymentMemo =
    ctx.paymentMemo ?? formatCitationPaymentMemo(content.id, content.author);

  // True when the payment settled to the creator's payout wallet (not the
  // legacy SELLER_ADDRESS fallback). The full amount goes to the creator.
  const settledToCreator =
    ctx.payTo.toLowerCase() === content.payoutWallet.toLowerCase();

  await recordCitationRoyalty({
    citationId: content.id,
    creatorName: content.author,
    creatorWallet: content.payoutWallet,
    payer: ctx.payer,
    grossUsdc: content.priceUsdc,
    gatewayTx: ctx.gatewayTx,
    query,
    paymentMemo,
    fullToCreator: settledToCreator,
  });

  if (content.source === "database") {
    await incrementPostPaidCount(content.id);
  }

  return buildCitationUnlockResponse(content, settledToCreator);
};

/** Soft-fail catalog enrichment so one bad dependency never 500s the feed. */
async function catalogSoft<T>(
  label: string,
  work: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await work;
  } catch (err) {
    console.error(
      `[citations] ${label} failed; serving catalog without it:`,
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}

/**
 * Cap enrichment work so TrustGate / Arc RPC slowness cannot exceed the
 * serverless budget (default hobby maxDuration is tight).
 */
function catalogRace<T>(work: Promise<T>, fallback: T, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    try {
      const forceBackingRefresh = req.nextUrl.searchParams.get("refresh") === "1";
      if (forceBackingRefresh) invalidateAttestationCache();

      const content = filterPublicResearchCatalog(await loadAllCreatorContent());
      const backingTargets = content.flatMap((item) => [
        authorBackingTarget(item.author),
        reportBackingTarget(item.id),
      ]);

      const agent = await catalogSoft(
        "resolveUserAgent",
        resolveUserAgent(),
        null,
      );
      const citationIds = content.map((item) => item.id);

      let creatorOwned = new Set<string>();
      try {
        const viewerWallets = await resolveCitationViewerWallets(req);
        creatorOwned = getCreatorOwnedPostIds(viewerWallets, content);
      } catch (err) {
        console.warn(
          "[citations] Creator access lookup failed; continuing without publisher auto-unlock:",
          err instanceof Error ? err.message : err,
        );
      }

      const emptyScores = new Map<string, TrustScore | null>();
      const emptyBacking = new Map<string, ResearchBackingStats>();
      const emptyLedger: CitationLedgerIndex = {
        byCitation: new Map(),
        creatorTotalsUsdc: new Map(),
      };
      const emptyComments = new Map<string, number>();
      const emptyPrior = new Set<string>();

      // Default load: skip per-target on-chain attestation fills (slow + flaky).
      // Explicit ?refresh=1 still does the full path for operators.
      const enrichmentBudgetMs = forceBackingRefresh ? 25_000 : 8_000;

      const [scores, backingIndex, priorUnlocks, ledgerStats, commentCounts] =
        await Promise.all([
          catalogSoft(
            "trust scores",
            catalogRace(
              getTrustScores(
                content.map((item) => resolveTrustIdentityWallet(item)),
              ),
              emptyScores,
              enrichmentBudgetMs,
            ),
            emptyScores,
          ),
          catalogSoft(
            "backing summaries",
            catalogRace(
              getBackingSummariesForTargets(backingTargets, {
                forceOnChain: forceBackingRefresh,
                skipOnChain: !forceBackingRefresh,
              }).then(indexBackingSummaries),
              emptyBacking,
              enrichmentBudgetMs,
            ),
            emptyBacking,
          ),
          catalogSoft(
            "prior unlocks",
            agent
              ? getPriorUnlockIds(agent.address, citationIds)
              : Promise.resolve(emptyPrior),
            emptyPrior,
          ),
          catalogSoft(
            "ledger stats",
            fetchCitationLedgerStats(
              citationIds,
              content.map((item) => item.payoutWallet),
            ),
            emptyLedger,
          ),
          catalogSoft(
            "comment counts",
            getCommentCountsForPosts(citationIds),
            emptyComments,
          ),
        ]);

      const paidTrustAvailable = isPaidTrustLookupAvailable();

      const items = content.map((item) => {
        const alreadyUnlocked =
          priorUnlocks.has(item.id) || creatorOwned.has(item.id);
        const ledger = getCitationLedgerStats(ledgerStats, item.id);
        const paidCount = Math.max(item.paidCount, ledger.allTimeReaders);
        return {
          id: item.id,
          title: item.title,
          author: item.author,
          price_usdc: item.priceUsdc,
          tags: item.tags,
          subheading: item.subheading,
          paid_count: paidCount,
          recent_readers_7d: ledger.recentReaders7d,
          post_earnings_usdc: ledger.postEarningsUsdc,
          creator_earnings_usdc: getCreatorEarningsUsdc(
            ledgerStats,
            item.payoutWallet,
          ),
          endpoint: `/api/marketplace/citations?id=${item.id}`,
          token: process.env.CANTEEN_USDC_ADDRESS ? "cUSDC" : "USDC",
          trust: trustScoreToSignal(
            scores.get(resolveTrustIdentityWallet(item).toLowerCase()) ?? null,
            "free",
            item.id,
          ),
          trust_paid_lookup: paidTrustAvailable,
          author_backing:
            backingIndex.get(authorBackingTarget(item.author)) ?? null,
          report_backing:
            backingIndex.get(reportBackingTarget(item.id)) ?? null,
          already_unlocked: alreadyUnlocked,
          is_own_post: creatorOwned.has(item.id),
          ...(alreadyUnlocked ? { unlocked_body: item.body } : {}),
          ...(item.publishedAt ? { published_at: item.publishedAt } : {}),
          ...(item.coverImageUrl ? { cover_image_url: item.coverImageUrl } : {}),
          ...(item.editVersion && item.editVersion > 1
            ? { edit_version: item.editVersion, last_edited_at: item.lastEditedAt ?? null }
            : {}),
          comment_count: commentCounts.get(item.id) ?? 0,
          author_is_username: item.source === "database",
          post_kind: item.postKind ?? "research",
          ...(item.postKind === "signal"
            ? {
                signal_direction: item.signalDirection ?? null,
                signal_confidence: item.signalConfidence ?? null,
                signal_horizon: item.signalHorizon ?? null,
                signal_invalidation: item.signalInvalidation ?? null,
              }
            : {}),
        };
      });

      return NextResponse.json({
        marketplace: "citation-agent",
        count: items.length,
        listings: items,
        purchase_endpoint: "/api/marketplace/citations?id=<listing-id>",
        trust_lookup_endpoint: "/api/trustgate/score?postId=<listing-id>",
      });
    } catch (err) {
      console.error(
        "[citations] Catalog list failed:",
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        {
          error: "Failed to load research catalog",
          detail: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  }

  const content = await getCreatorContentById(id);
  if (content) {
    const viewerWallets = await resolveCitationViewerWallets(req);
    if (isCreatorOwnedPost(content, viewerWallets)) {
      return buildCreatorCitationAccessResponse(content);
    }
  }

  const price = content ? `$${content.priceUsdc}` : "$0.001";
  const payTo = content ? resolveUnlockPayee(content) : null;

  return withGateway(paidHandler, price, "/api/marketplace/citations", payTo)(req);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = publishPayloadFromBody(body);
  const publishAuth = await verifyPublishRequest(req, payload);
  if (!publishAuth) {
    return NextResponse.json(
      { error: "Connect your wallet and sign the publish payload" },
      { status: 401 },
    );
  }

  // Conservative: publishing posts is a deliberate action. 10/min per wallet is
  // far above normal authoring cadence but blocks scripted spam.
  const rate = checkRateLimit(publishAuth.connectedWallet, {
    namespace: "citation-publish",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many publish requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const sessionAgent = await resolveUserAgent();
  const profileResult = await requirePublisherUsername(
    publishAuth.connectedWallet,
    sessionAgent?.address,
  );
  if (!profileResult.ok) {
    return NextResponse.json({ error: profileResult.error }, { status: profileResult.status });
  }

  // Set-once payout wallet with no publish-page field: reuse the stored
  // default; on a first publish with nothing stored, the signing wallet
  // silently becomes the default. Explicit payout_wallet stays supported for
  // direct API callers. The signature was verified against the payload as sent.
  const storedPayout = await getProfilePayoutWallet(profileResult.profile.id);
  const { payoutWallet: effectivePayout, storeAsDefault } = resolvePublishPayout({
    explicitPayout: payload.payoutWallet,
    storedPayout,
    connectedWallet: publishAuth.connectedWallet,
  });
  if (storeAsDefault) {
    const saved = await setProfilePayoutWallet({
      profileId: profileResult.profile.id,
      payoutWallet: storeAsDefault,
    });
    if (!saved.ok) {
      // Invalid addresses are caught by insert validation below; log the rest.
      console.warn("[citations] could not store default payout wallet:", saved.error);
    }
  }

  // scheduled_for is delivery metadata, not signed content. It is parsed from
  // the raw body and validated server-side in insertPublishedPost.
  const scheduledForRaw = body.scheduled_for ?? body.scheduledFor;
  const scheduledForMs =
    typeof scheduledForRaw === "string" && scheduledForRaw.trim()
      ? Date.parse(scheduledForRaw)
      : typeof scheduledForRaw === "number"
        ? scheduledForRaw
        : undefined;
  if (scheduledForRaw != null && scheduledForRaw !== "" && !Number.isFinite(scheduledForMs)) {
    return NextResponse.json({ error: "Invalid scheduled_for timestamp" }, { status: 400 });
  }

  const result = await insertPublishedPost({
    title: payload.title,
    subheading: payload.subheading,
    body: payload.body,
    priceUsdc: payload.priceUsdc,
    tags: payload.tags,
    username: profileResult.profile.username,
    payoutWallet: effectivePayout,
    connectedWallet: publishAuth.connectedWallet,
    signedAtMs: publishAuth.signedAtMs,
    coverImageUrl: payload.coverImageUrl,
    scheduledForMs: Number.isFinite(scheduledForMs) ? scheduledForMs : undefined,
    postKind: payload.postKind,
    signalDirection: payload.signalDirection,
    signalConfidence: payload.signalConfidence,
    signalHorizon: payload.signalHorizon,
    signalInvalidation: payload.signalInvalidation,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    await ensurePublisherLinkedToSession(publishAuth.connectedWallet);
  } catch (err) {
    console.warn(
      "[citations] Could not link publisher wallet after publish:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json(
    {
      post: {
        id: result.post.id,
        title: result.post.title,
        subheading: result.post.subheading,
        price_usdc: result.post.price_usdc,
        paid_count: result.post.paid_count,
        author: result.post.author_name,
        tags: result.post.tags,
        publish_signed_at: result.post.publish_signed_at,
        published_at: result.post.published_at,
        cover_image_url: result.post.cover_image_url,
        post_kind: result.post.post_kind ?? "research",
        signal_direction: result.post.signal_direction,
        signal_confidence: result.post.signal_confidence,
        signal_horizon: result.post.signal_horizon,
        signal_invalidation: result.post.signal_invalidation,
        endpoint: `/api/marketplace/citations?id=${result.post.id}`,
      },
    },
    { status: 201 },
  );
}

/**
 * Edit a published post. Same wallet-signature scheme as publishing: the
 * signature binds the NEW content digest; ownership is enforced against the
 * post's publishing wallet. The pre-edit content is version-snapshotted.
 */
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof body.id === "string" ? body.id.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "Missing post id" }, { status: 400 });
  }

  const payload = publishPayloadFromBody(body);
  const publishAuth = await verifyPublishRequest(req, payload);
  if (!publishAuth) {
    return NextResponse.json(
      { error: "Connect your wallet and sign the edited payload" },
      { status: 401 },
    );
  }

  const rate = checkRateLimit(publishAuth.connectedWallet, {
    namespace: "citation-edit",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many edit requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const result = await updatePublishedPost({
    postId,
    title: payload.title,
    subheading: payload.subheading,
    body: payload.body,
    priceUsdc: payload.priceUsdc,
    tags: payload.tags,
    coverImageUrl: payload.coverImageUrl,
    changeNote: typeof body.change_note === "string" ? body.change_note : undefined,
    connectedWallet: publishAuth.connectedWallet,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    post: {
      id: result.post.id,
      title: result.post.title,
      subheading: result.post.subheading,
      price_usdc: result.post.price_usdc,
      tags: result.post.tags,
      edit_version: result.post.edit_version,
      last_edited_at: result.post.last_edited_at,
    },
  });
}