"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrustSignalBadge,
  type PublicTrustSignal,
} from "@/components/marketplace/trust-signal";
import { getConnectedAccount, switchToArcTestnet } from "@/lib/attestation-client";
import { formatPaymentDate } from "@/lib/format-datetime";
import { buildPostSharePath, copyPostShareLink } from "@/lib/post-share-url";
import { myPostsHeaders, signMyPostsAuth } from "@/lib/publish-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import "@/lib/ethereum-provider";

type PublisherPost = {
  id: string;
  title: string;
  price_usdc: string;
  paid_count: number;
  post_earnings_usdc?: number;
  published_at?: string;
  trust?: PublicTrustSignal | null;
};

type Props = {
  connected: `0x${string}`;
  walletTrust: PublicTrustSignal | null;
  walletTrustLoading?: boolean;
  refreshKey?: number;
};

function paidCountLabel(count: number): string {
  if (count === 0) return "0 readers";
  if (count === 1) return "1 reader";
  return `${count} readers`;
}

export function PublisherPostsDropdown({
  connected,
  walletTrust,
  walletTrustLoading = false,
  refreshKey = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<PublisherPost[]>([]);
  const [loadedRefreshKey, setLoadedRefreshKey] = useState<number | null>(null);

  const loadPosts = useCallback(async () => {
    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum) return;

    setLoading(true);
    try {
      await switchToArcTestnet(ethereum);
      const account = connected ?? (await getConnectedAccount(ethereum));
      const auth = await signMyPostsAuth(ethereum, account);
      const res = await fetch("/api/marketplace/my-posts", {
        headers: myPostsHeaders(auth),
      });
      const data = (await res.json()) as {
        error?: string;
        posts?: PublisherPost[];
        publisher_trust?: PublicTrustSignal | null;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Could not load posts (${res.status})`);
      }
      setPosts(data.posts ?? []);
      setLoadedRefreshKey(refreshKey);
    } catch (err) {
      if ((err as { code?: number }).code === 4001) {
        toast.message("Signature cancelled");
        return;
      }
      toast.error("Could not load your posts", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [connected, refreshKey]);

  useEffect(() => {
    if (open && loadedRefreshKey !== refreshKey) {
      void loadPosts();
    }
  }, [loadPosts, loadedRefreshKey, open, refreshKey]);

  const copyShareLink = useCallback(async (postId: string) => {
    try {
      const url = await copyPostShareLink(postId);
      toast.success("Link copied", { description: url });
    } catch (err) {
      toast.error("Could not copy link", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  const shortAddress = `${connected.slice(0, 6)}...${connected.slice(-4)}`;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-[#333] font-mono text-xs"
        >
          <FileText size={14} className="text-[#f5c842]" />
          My posts
          {!walletTrustLoading && walletTrust && (
            <span className="text-[#666] hidden sm:inline">
              · {walletTrust.score}
            </span>
          )}
          <ChevronDown size={14} className="text-[#666]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(100vw-2rem,22rem)] border-[#333] bg-[#111] p-0"
      >
        <div className="px-3 py-2.5 space-y-1.5 border-b border-[#1f1f1f]">
          <DropdownMenuLabel className="p-0 font-mono text-[10px] uppercase tracking-wider text-[#666]">
            Publisher · {shortAddress}
          </DropdownMenuLabel>
          <div className="flex flex-wrap items-center gap-2">
            {walletTrustLoading ? (
              <span className="font-mono text-[10px] text-[#666]">Loading score…</span>
            ) : (
              <TrustSignalBadge
                trust={walletTrust}
                className="border-[#f5c842]/25 text-[#f5c842]"
              />
            )}
          </div>
        </div>

        <div className="max-h-[min(60vh,20rem)] overflow-y-auto p-2 space-y-2">
          {loading && posts.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 font-mono text-xs text-[#666]">
              <Loader2 size={14} className="animate-spin" />
              Loading listings…
            </div>
          )}

          {!loading && posts.length === 0 && (
            <p className="px-2 py-4 text-center font-mono text-[10px] text-[#666]">
              No published posts yet. Expand article details below to publish.
            </p>
          )}

          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-2.5 space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
                  ${post.price_usdc}
                </Badge>
                <TrustSignalBadge trust={post.trust ?? walletTrust} />
                <span className="font-mono text-[10px] text-[#666]">
                  {paidCountLabel(post.paid_count)}
                </span>
              </div>
              <p className="text-xs font-semibold tracking-wide text-[#f5f5f5] line-clamp-2">
                {post.title}
              </p>
              {post.published_at && (
                <p className="font-mono text-[10px] text-[#666]">
                  {formatPaymentDate(post.published_at)}
                </p>
              )}
              <div className="flex gap-1 pt-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void copyShareLink(post.id)}
                  className="h-6 px-2 font-mono text-[10px] text-[#888]"
                >
                  Copy link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  asChild
                  className="h-6 px-2 font-mono text-[10px] text-[#888]"
                >
                  <Link href={buildPostSharePath(post.id)} onClick={() => setOpen(false)}>
                    View
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DropdownMenuSeparator className="bg-[#1f1f1f]" />
        <div className="px-2 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => void loadPosts()}
            className={cn(
              "w-full h-8 font-mono text-[10px] text-[#888] hover:text-[#f5f5f5]",
            )}
          >
            {loading ? "Refreshing…" : "Refresh listings"}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}