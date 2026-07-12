"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaymentDate } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

type FeedPost = {
  id: string;
  title: string;
  author: string;
  displayAuthor: string;
  profilePath: string;
  path: string;
  price_usdc: string;
  tags: string[];
  subheading: string;
  paid_count: number;
  published_at: string | null;
};

const SEEN_KEY = "citation-agent:following-seen-at";

/**
 * Read-only feed of posts from creators the user already follows.
 * Discovery / follow actions live only on the hero Follow control.
 */
export function FollowingFeedPanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [requiresUsername, setRequiresUsername] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace/following/feed");
      if (!res.ok) {
        setPosts([]);
        return;
      }
      const data = (await res.json()) as {
        posts?: FeedPost[];
        requiresUsername?: boolean;
      };
      const list = data.posts ?? [];
      setPosts(list);
      setRequiresUsername(Boolean(data.requiresUsername));

      let seenAt = 0;
      try {
        const raw = window.localStorage.getItem(SEEN_KEY);
        if (raw) seenAt = Number(raw) || 0;
      } catch {
        seenAt = 0;
      }
      const fresh = list.filter((p) => {
        if (!p.published_at) return false;
        return new Date(p.published_at).getTime() > seenAt;
      }).length;
      setNewCount(fresh);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!expanded || posts.length === 0) return;
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()));
      setNewCount(0);
    } catch {
      // ignore
    }
  }, [expanded, posts.length]);

  return (
    <Panel id="following-feed" className="space-y-3 p-4 sm:p-5 border-[#1f1f1f] scroll-mt-24">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#333] bg-[#111]">
          <Bell size={16} className="text-[#f5c842]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide">Following</h2>
            {newCount > 0 && (
              <Badge className="bg-[#f5c842]/15 text-[#f5c842] border border-[#f5c842]/30 text-[10px]">
                {newCount} new
              </Badge>
            )}
          </div>
          <p className="font-mono text-[10px] text-[#666] mt-0.5">
            Reports from creators you follow
          </p>
        </div>
        <span
          className={cn(
            "font-mono text-[10px] text-[#666] mt-1 transition-transform",
            expanded && "rotate-180",
          )}
        >
          v
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[#1f1f1f] pt-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 font-mono text-xs text-[#666] py-4 justify-center">
              <Loader2 size={14} className="animate-spin" />
              Loading feed…
            </div>
          )}

          {!loading && requiresUsername && (
            <p className="font-mono text-xs text-[#888] leading-relaxed">
              Choose a @username (publish panel or first comment), then use{" "}
              <span className="text-[#a3a3a3]">Follow</span> at the top of the page
              to pick publishers.
            </p>
          )}

          {!loading && !requiresUsername && posts.length === 0 && (
            <p className="font-mono text-xs text-[#888] leading-relaxed">
              No followed desks yet. Use{" "}
              <span className="text-[#a3a3a3]">Follow</span> next to Browse catalog
              to add publishers with live reports.
            </p>
          )}

          {!loading &&
            posts.map((post) => (
              <div
                key={post.id}
                className="rounded border border-[#1f1f1f] bg-[#111]/60 p-3 space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={post.profilePath}
                    className="font-mono text-[10px] text-[#f5c842] hover:underline"
                  >
                    {post.displayAuthor}
                  </Link>
                  <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
                    ${post.price_usdc}
                  </Badge>
                  {post.published_at && (
                    <span className="font-mono text-[10px] text-[#666]">
                      {formatPaymentDate(post.published_at)}
                    </span>
                  )}
                </div>
                <Link
                  href={post.path}
                  className="block text-sm font-medium tracking-wide text-[#f5f5f5] hover:text-[#f5c842]"
                >
                  {post.title}
                </Link>
                <p className="font-mono text-[10px] text-[#666] line-clamp-2">
                  {post.subheading}
                </p>
              </div>
            ))}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            className="font-mono text-[10px] text-[#666]"
          >
            Refresh feed
          </Button>
        </div>
      )}
    </Panel>
  );
}
