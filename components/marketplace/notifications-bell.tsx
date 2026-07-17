"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { buildMarketplacePostPath } from "@/lib/post-share-url";
import { buildProfilePath } from "@/lib/profile-url";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  createdAt: string;
  type: "follow" | "comment" | "reply" | "sale";
  actorUsername: string | null;
  postId: string | null;
  read: boolean;
};

const POLL_MS = 60_000;

function itemText(item: NotificationItem): string {
  const actor = item.actorUsername ? `@${item.actorUsername}` : "Someone";
  switch (item.type) {
    case "follow":
      return `${actor} started following you`;
    case "comment":
      return `${actor} commented on your report`;
    case "reply":
      return `${actor} replied to your comment`;
    case "sale":
      return "Your report was unlocked — royalty earned";
    default:
      return "New activity";
  }
}

function itemHref(item: NotificationItem): string | null {
  if (item.postId) return buildMarketplacePostPath(item.postId);
  if (item.type === "follow" && item.actorUsername) {
    return buildProfilePath(item.actorUsername);
  }
  return null;
}

/** Header bell: unread badge + dropdown of recent activity, marks read on open. */
export function NotificationsBell({ className }: { className?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/marketplace/notifications", {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: NotificationItem[];
        unread?: number;
      };
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // Quiet: the bell must never surface errors in the header.
    }
  }, []);

  useEffect(() => {
    // Defer the first load a tick so the effect never sets state synchronously.
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next && unread > 0) {
        setUnread(0);
        void fetch("/api/marketplace/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "mark-read" }),
        }).catch(() => {});
      }
      return next;
    });
  }, [unread]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded border border-transparent text-[#888]",
          "transition-colors hover:border-[#333] hover:text-[#f5f5f5]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
        )}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f5c842] px-1 font-mono text-[9px] font-semibold text-[#0a0a0a]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded border border-[#1f1f1f] bg-[#0d0d0d] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <p className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#666]">
            Notifications
          </p>
          {items.length === 0 ? (
            <p className="px-2 pb-2 font-mono text-[11px] text-[#555]">
              No activity yet. Publish research or follow creators to get started.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((item) => {
                const href = itemHref(item);
                const line = (
                  <div
                    className={cn(
                      "rounded px-2 py-1.5 font-mono text-[11px] leading-relaxed",
                      item.read ? "text-[#777]" : "text-[#d4d4d4]",
                      href && "hover:bg-[#161616]",
                    )}
                  >
                    {itemText(item)}
                    <span className="block text-[9px] text-[#555]">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
                return href ? (
                  <Link key={item.id} href={href} onClick={() => setOpen(false)}>
                    {line}
                  </Link>
                ) : (
                  <div key={item.id}>{line}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
