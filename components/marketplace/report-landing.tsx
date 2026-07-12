"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Loader2, Lock, Users } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FollowCreatorButton } from "@/components/marketplace/follow-creator-button";
import { MentionText } from "@/components/marketplace/mention-text";
import { buildMarketplacePostPath, copyPostShareLink } from "@/lib/post-share-url";
import { buildProfilePath } from "@/lib/profile-url";
import { formatPaymentDate } from "@/lib/format-datetime";
import { formatUsernameDisplay } from "@/lib/username";
import { isPublicResearchListing } from "@/lib/catalog-filter";
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
};

export function ReportLanding({ postId }: { postId: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/marketplace/citations")
      .then(async (res) => {
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
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load report");
          setListing(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
            Paywalled research
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

        <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-4 space-y-3">
          <div className="flex items-start gap-2">
            <Lock size={16} className="mt-0.5 shrink-0 text-[#f5c842]" />
            <div className="space-y-1">
              <p className="text-sm font-medium tracking-wide">Full report is locked</p>
              <p className="font-mono text-xs text-[#666] leading-relaxed">
                Unlock with USDC via Circle Gateway on the marketplace. Deposit once,
                then buy without repeated wallet popups.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
      </Panel>
    </div>
  );
}
