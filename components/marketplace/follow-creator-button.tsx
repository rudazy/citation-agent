"use client";

import { useCallback, useState } from "react";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  username: string;
  initialFollowing?: boolean;
  isSelf?: boolean;
  className?: string;
  onChange?: (following: boolean) => void;
};

export function FollowCreatorButton({
  username,
  initialFollowing = false,
  isSelf = false,
  className,
  onChange,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (isSelf || busy) return;
    setBusy(true);
    try {
      if (following) {
        const res = await fetch(
          `/api/marketplace/follow?username=${encodeURIComponent(username)}`,
          { method: "DELETE" },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          if (data.code === "username_required" || data.error?.includes("username")) {
            toast.error("Username required", {
              description: "Choose a @username on the marketplace before following.",
            });
          } else {
            toast.error("Could not unfollow", {
              description: data.error ?? `Error ${res.status}`,
            });
          }
          return;
        }
        setFollowing(false);
        onChange?.(false);
        toast.message(`Unfollowed @${username}`);
      } else {
        const res = await fetch("/api/marketplace/follow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          if (data.code === "username_required" || data.error?.includes("username")) {
            toast.error("Username required", {
              description: "Choose a @username before following creators.",
            });
          } else {
            toast.error("Could not follow", {
              description: data.error ?? `Error ${res.status}`,
            });
          }
          return;
        }
        setFollowing(true);
        onChange?.(true);
        toast.success(`Following @${username}`, {
          description: "New reports will show in your Following feed.",
        });
      }
    } catch (err) {
      toast.error("Follow failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, following, isSelf, onChange, username]);

  if (isSelf) {
    return (
      <span className={cn("font-mono text-[10px] text-[#666]", className)}>
        This is you
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => void toggle()}
      className={cn(
        "gap-1.5 font-mono text-xs border-[#333]",
        following
          ? "text-[#a3a3a3] hover:text-[#f5f5f5]"
          : "border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10",
        className,
      )}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : following ? (
        <UserMinus size={14} />
      ) : (
        <UserPlus size={14} />
      )}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
