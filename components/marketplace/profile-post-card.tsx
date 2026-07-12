"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MentionText } from "@/components/marketplace/mention-text";
import { buildMarketplacePostPath } from "@/lib/post-share-url";
import { formatPaymentDate } from "@/lib/format-datetime";

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
};

type Props = {
  post: ProfilePostCardData;
};

/**
 * Profile listing card: teaser only. View opens the catalog post for unlock/read.
 */
export function ProfilePostCard({ post }: Props) {
  const viewHref = buildMarketplacePostPath(post.id);

  return (
    <article className="rounded border border-[#1f1f1f] bg-[#111]/80 p-4 space-y-3 transition-colors hover:border-[#f5c842]/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
              ${post.price_usdc} USDC
            </Badge>
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
            Opens in catalog to unlock and read
          </p>
        </div>
      </div>
    </article>
  );
}
