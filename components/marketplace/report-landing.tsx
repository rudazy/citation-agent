"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Loader2, Lock, Unlock, Users } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FollowCreatorButton } from "@/components/marketplace/follow-creator-button";
import { MentionText } from "@/components/marketplace/mention-text";
import { CitationBodyMarkdown } from "@/components/marketplace/citation-body-markdown";
import { buildMarketplacePostPath, copyPostShareLink } from "@/lib/post-share-url";
import { buildProfilePath } from "@/lib/profile-url";
import { formatPaymentDate } from "@/lib/format-datetime";
import { formatUsernameDisplay } from "@/lib/username";
import { isPublicResearchListing } from "@/lib/catalog-filter";
import { resolveCatalogAuthHeaders } from "@/lib/citation-catalog-auth";
import { tryPublisherCitationAccess } from "@/lib/citation-unlock-client";
import { toast } from "sonner";

type Listing = {
  id: string;
  title: string;
  author: string;
  price_usdc: string;
  tags: string[];
  subheading: string;
  paid_count: number;
  published_at?: string;
  author_is_username?: boolean;
  already_unlocked?: boolean;
  is_own_post?: boolean;
  unlocked_body?: string;
};

export function ReportLanding({ postId }: { postId: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        // Include catalog auth so the API marks is_own_post / already_unlocked.
        const authHeaders = await resolveCatalogAuthHeaders();
        const res = await fetch("/api/marketplace/citations", {
          headers: authHeaders,
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`Failed to load report (${res.status})`);
        const data = (await res.json()) as { listings?: Listing[] };
        const found = (data.listings ?? []).find((l) => l.id === postId);
        if (cancelled) return;
        if (!found || !isPublicResearchListing(found)) {
          setError("Report not found");
          setListing(null);
          return;
        }
        setListing(found);
        if (found.unlocked_body) {
          setBody(found.unlocked_body);
        } else if (found.is_own_post || found.already_unlocked) {
          // Free access via session/linked wallet without body in list path edge case.
          const free = await tryPublisherCitationAccess(postId, authHeaders);
          if (!cancelled && free?.status === "ok") {
            setBody(free.body);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load report");
          setListing(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const copyShare = useCallback(async () => {
    try {
      const url = await copyPostShareLink(postId);
      toast.success("Link copied", { description: url });
    } catch (err) {
      toast.error("Could not copy link", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [postId]);

  const openAsPublisher = useCallback(async () => {
    setUnlocking(true);
    try {
      const authHeaders = await resolveCatalogAuthHeaders({
        signIfMissing: true,
        forceSign: true,
      });
      const free = await tryPublisherCitationAccess(postId, authHeaders);
      if (free?.status === "ok") {
        setBody(free.body);
        toast.success("Your post — no payment needed");
        return;
      }
      toast.message("Connect the wallet that published this post to open it free", {
        description: "Or unlock with USDC on the marketplace.",
      });
    } catch (err) {
      toast.error("Could not open report", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setUnlocking(false);
    }
  }, [postId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl flex items-center justify-center gap-2 py-16 font-mono text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin text-[#f5c842]" />
        Loading report…
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          {error ?? "Report not found"}
        </p>
        <Button asChild variant="outline" className="font-mono text-xs border-[#333]">
          <Link href="/marketplace">Browse research</Link>
        </Button>
      </div>
    );
  }

  const authorLabel = listing.author_is_username
    ? formatUsernameDisplay(listing.author)
    : listing.author;
  const profileHref = listing.author_is_username
    ? buildProfilePath(listing.author)
    : null;
  const unlockHref = buildMarketplacePostPath(listing.id);
  const isOpen = Boolean(body);

  return (
    <div className="mx-auto max-w-3xl w-full space-y-6">
      <Panel glow className="space-y-5 p-5 sm:p-6 border-[#f5c842]/20">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
            ${listing.price_usdc} USDC
          </Badge>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#666]">
            <Users size={10} />
            {listing.paid_count} reader{listing.paid_count === 1 ? "" : "s"}
          </span>
          {listing.published_at && (
            <span className="font-mono text-[10px] text-[#666]">
              {formatPaymentDate(listing.published_at)}
            </span>
          )}
          <Badge className="bg-[#f5c842]/10 text-[#f5c842] border border-[#f5c842]/30 text-[10px]">
            {isOpen
              ? listing.is_own_post
                ? "Your post"
                : "Unlocked"
              : "Paywalled research"}
          </Badge>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide leading-snug text-[#f5f5f5]">
            {listing.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {profileHref ? (
              <Link
                href={profileHref}
                className="font-mono text-sm text-[#f5c842] hover:underline"
              >
                {authorLabel}
              </Link>
            ) : (
              <span className="font-mono text-sm text-[#888]">{authorLabel}</span>
            )}
            {listing.author_is_username && (
              <FollowCreatorButton username={listing.author} />
            )}
          </div>
          <p className="font-mono text-sm text-[#a3a3a3] leading-relaxed">
            <MentionText text={listing.subheading} />
          </p>
        </div>

        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {listing.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-[#1f1f1f] px-2 py-0.5 font-mono text-[10px] text-[#666]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {isOpen ? (
          <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-[#c8f135]">
              <Unlock size={16} />
              <p className="font-mono text-xs">
                {listing.is_own_post
                  ? "Publisher access — no payment required"
                  : "Full report unlocked"}
              </p>
            </div>
            <CitationBodyMarkdown content={body!} />
          </div>
        ) : (
          <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-4 space-y-3">
            <div className="flex items-start gap-2">
              <Lock size={16} className="mt-0.5 shrink-0 text-[#f5c842]" />
              <div className="space-y-1">
                <p className="text-sm font-medium tracking-wide">Full report is locked</p>
                <p className="font-mono text-xs text-[#666] leading-relaxed">
                  If you published this post, connect the same wallet to open it free.
                  Otherwise unlock with USDC via Circle Gateway on the marketplace.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={unlocking}
                onClick={() => void openAsPublisher()}
                className="border border-[#c8f135]/40 bg-[#c8f135]/10 text-[#c8f135] hover:bg-[#c8f135]/20 font-mono text-xs"
              >
                {unlocking ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Checking…
                  </>
                ) : (
                  "I wrote this — open free"
                )}
              </Button>
              <Button
                asChild
                className="border border-[#f5c842]/40 bg-[#f5c842]/10 text-[#f5c842] hover:bg-[#f5c842]/20 font-mono text-xs"
              >
                <Link href={unlockHref}>Unlock · ${listing.price_usdc}</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyShare()}
                className="gap-1.5 border-[#333] font-mono text-xs"
              >
                <Link2 size={14} />
                Copy share link
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="font-mono text-xs text-[#888]"
              >
                <Link href="/marketplace">Browse all research</Link>
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
