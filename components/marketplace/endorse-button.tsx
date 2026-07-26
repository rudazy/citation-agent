"use client";

import { useCallback, useState } from "react";
import { BadgeCheck, Loader2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { curatorRateLabel } from "@/lib/curator-share";
import { cn } from "@/lib/utils";

type Props = {
  postId: string;
  initialEndorsed?: boolean;
  initialCount?: number;
  /** Hidden for a creator's own work — you cannot stamp yourself. */
  isOwnPost?: boolean;
  className?: string;
  onChange?: (endorsed: boolean) => void;
};

const ENDORSEMENT_RATE_LABEL = curatorRateLabel("endorsement");

async function copyShareLink(sharePath: string): Promise<void> {
  await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
}

/**
 * A stamp on work this desk stands behind. Endorsing also mints the curator's
 * referral link: unlocks routed through it accrue curator credit.
 */
export function EndorseButton({
  postId,
  initialEndorsed = false,
  initialCount = 0,
  isOwnPost = false,
  className,
  onChange,
}: Props) {
  const [endorsed, setEndorsed] = useState(initialEndorsed);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (isOwnPost || busy) return;
    setBusy(true);

    try {
      const res = endorsed
        ? await fetch(
            `/api/marketplace/endorsements?postId=${encodeURIComponent(postId)}`,
            { method: "DELETE" },
          )
        : await fetch("/api/marketplace/endorsements", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ postId }),
          });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        share_path?: string;
      };

      if (!res.ok) {
        if (data.code === "username_required") {
          toast.error("Username required", {
            description: "Claim a @username before endorsing other desks.",
          });
        } else {
          toast.error(endorsed ? "Could not remove stamp" : "Could not endorse", {
            description: data.error ?? `Error ${res.status}`,
          });
        }
        return;
      }

      if (endorsed) {
        setEndorsed(false);
        setCount((n) => Math.max(0, n - 1));
        onChange?.(false);
        toast.message("Endorsement removed");
        return;
      }

      setEndorsed(true);
      setCount((n) => n + 1);
      onChange?.(true);

      const sharePath = data.share_path;
      toast.success("Endorsed", {
        description: sharePath
          ? `Share your link to earn ${ENDORSEMENT_RATE_LABEL} curator credit on unlocks you route.`
          : "Your stamp is now public on this post.",
        ...(sharePath
          ? {
              action: {
                label: "Copy link",
                onClick: () => {
                  void copyShareLink(sharePath)
                    .then(() => toast.message("Referral link copied"))
                    .catch(() => toast.error("Could not copy link"));
                },
              },
            }
          : {}),
      });
    } catch (err) {
      toast.error("Endorsement failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, endorsed, isOwnPost, onChange, postId]);

  if (isOwnPost) {
    if (count === 0) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[10px] text-[#666]",
          className,
        )}
      >
        <BadgeCheck size={12} className="text-[#f5c842]" />
        {count} endorsed
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
      title={
        endorsed
          ? "Remove your stamp from this post"
          : `Stand behind this work — earn ${ENDORSEMENT_RATE_LABEL} curator credit on unlocks you route`
      }
      className={cn(
        "gap-1.5 font-mono text-xs border-[#333]",
        endorsed
          ? "border-[#f5c842]/35 bg-[#f5c842]/10 text-[#f5c842]"
          : "text-[#a3a3a3] hover:text-[#f5f5f5]",
        className,
      )}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : endorsed ? (
        <BadgeCheck size={14} />
      ) : (
        <Stamp size={14} />
      )}
      {endorsed ? "Endorsed" : "Endorse"}
      {count > 0 ? <span className="text-[#666]">{count}</span> : null}
    </Button>
  );
}
