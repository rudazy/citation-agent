"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FollowCreatorButton } from "@/components/marketplace/follow-creator-button";
import { formatUsernameDisplay } from "@/lib/username";
import { cn } from "@/lib/utils";

export type RecommendRow = {
  username: string;
  displayName: string;
  profilePath: string;
  postCount: number;
  totalReaders: number;
  latestTitle: string | null;
  following: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FollowDiscoverDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RecommendRow[]>([]);
  const [hasUsername, setHasUsername] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/follow/recommendations");
      if (!res.ok) {
        throw new Error(`Failed to load publishers (${res.status})`);
      }
      const data = (await res.json()) as {
        recommendations?: RecommendRow[];
        hasUsername?: boolean;
      };
      setRows(data.recommendations ?? []);
      setHasUsername(data.hasUsername !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#1f1f1f] bg-[#0a0a0a] text-[#f5f5f5] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="tracking-wide flex items-center gap-2">
            <Users size={16} className="text-[#f5c842]" />
            Follow publishers
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#666]">
            Only accounts with published research. Their posts appear on their
            profile and in your Following feed.
          </DialogDescription>
        </DialogHeader>

        {!hasUsername && (
          <p className="rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-[10px] text-[#888] leading-relaxed">
            Choose a @username (publish panel or first comment) before following.
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 font-mono text-xs text-[#666]">
            <Loader2 size={14} className="animate-spin text-[#f5c842]" />
            Loading publishers…
          </div>
        )}

        {error && (
          <p className="font-mono text-xs text-red-400">{error}</p>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="py-8 text-center font-mono text-xs text-[#666]">
            No published desks to recommend yet.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <ul className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => (
              <li
                key={row.username}
                className={cn(
                  "flex items-start gap-3 rounded border border-[#1f1f1f] bg-[#111]/80 px-3 py-2.5",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={row.profilePath}
                    onClick={() => onOpenChange(false)}
                    className="font-mono text-xs text-[#f5c842] hover:underline"
                  >
                    {formatUsernameDisplay(row.username)}
                  </Link>
                  <p className="font-mono text-[10px] text-[#666]">
                    {row.postCount} report{row.postCount === 1 ? "" : "s"}
                    {" · "}
                    {row.totalReaders} reader{row.totalReaders === 1 ? "" : "s"}
                  </p>
                  {row.latestTitle && (
                    <p className="font-mono text-[10px] text-[#888] line-clamp-1">
                      Latest: {row.latestTitle}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <FollowCreatorButton
                    username={row.username}
                    initialFollowing={row.following}
                    onChange={(following) => {
                      setRows((prev) =>
                        prev.map((r) =>
                          r.username === row.username ? { ...r, following } : r,
                        ),
                      );
                    }}
                  />
                  <Link
                    href={row.profilePath}
                    onClick={() => onOpenChange(false)}
                    className="font-mono text-[10px] text-[#555] hover:text-[#f5c842]"
                  >
                    View profile
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 border-t border-[#1f1f1f] pt-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            className="font-mono text-[10px] text-[#666]"
          >
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#333] font-mono text-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Compact hero control that opens the discover dialog. */
export function FollowHeroButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded border border-[#333] px-3 py-1.5 font-mono text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555]",
          className,
        )}
      >
        <UserPlus size={12} />
        Follow
      </button>
      <FollowDiscoverDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
