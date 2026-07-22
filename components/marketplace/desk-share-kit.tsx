"use client";

import { useCallback, useState } from "react";
import { Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildDeskShareText } from "@/lib/signal-card";
import { buildProfileUrl } from "@/lib/profile-url";

type Props = {
  username: string;
  className?: string;
};

/**
 * Outbound share kit for a Creator Desk — copy desk URL or X/YouTube paste text.
 */
export function DeskShareKit({ username, className }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  const copyLink = useCallback(async () => {
    try {
      const url = buildProfileUrl(username, window.location.origin);
      await navigator.clipboard.writeText(url);
      toast.success("Desk link copied", { description: url });
    } catch (err) {
      toast.error("Could not copy link", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [username]);

  const copyShareKit = useCallback(async () => {
    try {
      const url = buildProfileUrl(username, window.location.origin);
      const text = buildDeskShareText({ username, url });
      await navigator.clipboard.writeText(text);
      setPreview(text);
      toast.success("Desk share kit copied", {
        description: "Paste into an X bio, thread, or YouTube description.",
      });
    } catch (err) {
      toast.error("Could not copy share kit", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [username]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void copyLink()}
          className="gap-1.5 font-mono text-xs text-[#888] hover:text-[#f5c842]"
        >
          <Link2 size={14} />
          Copy desk link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copyShareKit()}
          className="gap-1.5 border-[#333] font-mono text-xs text-[#f5c842]"
        >
          <Share2 size={14} />
          Share kit
        </Button>
      </div>
      {preview && (
        <pre className="mt-2 whitespace-pre-wrap rounded border border-[#1f1f1f] bg-[#111]/80 px-3 py-2 font-mono text-[10px] leading-relaxed text-[#888]">
          {preview}
        </pre>
      )}
    </div>
  );
}
