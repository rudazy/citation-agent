"use client";

import Link from "next/link";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MentionText } from "@/components/marketplace/mention-text";
import { buildMarketplacePostPath } from "@/lib/post-share-url";
import { formatPaymentDate } from "@/lib/format-datetime";
import {
  SIGNAL_DIRECTION_LABELS,
  SIGNAL_HORIZON_LABELS,
  type SignalDirection,
  type SignalHorizon,
} from "@/lib/signal-card";

export type ProfilePostCardData = {
  id: string;
  title: string;
  author?: string;
  subheading: string;
  price_usdc: string;
  tags: string[];
  paid_count: number;
  published_at: string | null;
  path: string;
  post_kind?: "research" | "signal";
  endorsement_count?: number;
  endorsed_by?: string[];
  signal_direction?: string | null;
  signal_confidence?: number | null;
  signal_horizon?: string | null;
  signal_invalidation?: string | null;
};

type Props = {
  post: ProfilePostCardData;
};

/**
 * Desk listing card: teaser only. View opens the catalog post for unlock/read.
 */
export function ProfilePostCard({ post }: Props) {
  const viewHref = buildMarketplacePostPath(post.id);
  const isSignal = post.post_kind === "signal";
  const direction = post.signal_direction as SignalDirection | null | undefined;
  const horizon = post.signal_horizon as SignalHorizon | null | undefined;

  return (
    <article className="rounded border border-[#1f1f1f] bg-[#111]/80 p-4 space-y-3 transition-colors hover:border-[#f5c842]/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {isSignal ? (
              <Badge
                variant="outline"
                className="border-[#c8f135]/35 font-mono text-[10px] text-[#c8f135]"
              >
                Signal
              </Badge>
            ) : (
              <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
                Research
              </Badge>
            )}
            <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
              ${post.price_usdc} USDC
            </Badge>
            {isSignal && direction && SIGNAL_DIRECTION_LABELS[direction] && (
              <span className="font-mono text-[10px] text-[#c8f135]">
                {SIGNAL_DIRECTION_LABELS[direction]}
                {post.signal_confidence != null
                  ? ` · ${post.signal_confidence}/5`
                  : ""}
                {horizon && SIGNAL_HORIZON_LABELS[horizon]
                  ? ` · ${SIGNAL_HORIZON_LABELS[horizon]}`
                  : ""}
              </span>
            )}
            <span className="font-mono text-[10px] text-[#666]">
              {post.paid_count} reader{post.paid_count === 1 ? "" : "s"}
            </span>
            {post.published_at && (
              <span className="font-mono text-[10px] text-[#666]">
                {formatPaymentDate(post.published_at)}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
            {post.title}
          </h3>
          <p className="font-mono text-xs text-[#888] leading-relaxed line-clamp-3">
            <MentionText text={post.subheading} />
          </p>
          {isSignal && post.signal_invalidation && (
            <p className="font-mono text-[10px] text-[#666] leading-relaxed">
              Invalidation: {post.signal_invalidation}
            </p>
          )}
          {(post.endorsement_count ?? 0) > 0 && (
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-[#888]">
              <BadgeCheck size={12} className="shrink-0 text-[#f5c842]" />
              Endorsed by{" "}
              {(post.endorsed_by ?? []).map((u) => `@${u}`).join(", ")}
              {post.endorsement_count! > (post.endorsed_by?.length ?? 0)
                ? ` +${post.endorsement_count! - (post.endorsed_by?.length ?? 0)} more`
                : ""}
            </p>
          )}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[#1f1f1f] px-1.5 py-0.5 font-mono text-[10px] text-[#666]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-1.5 border-[#f5c842]/35 font-mono text-xs text-[#f5c842] hover:bg-[#f5c842]/10"
          >
            <Link href={viewHref}>
              View
              <ExternalLink size={12} />
            </Link>
          </Button>
          <p className="font-mono text-[10px] text-[#555] sm:text-right max-w-[11rem]">
            {isSignal
              ? "Opens in catalog to unlock thesis"
              : "Opens in catalog to unlock and read"}
          </p>
        </div>
      </div>
    </article>
  );
}
