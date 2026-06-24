"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { imageMarkdownAtCursor, insertTextAtCursor } from "@/lib/article-image";
import { imageFileFromClipboard, uploadArticleImage } from "@/lib/article-image-upload";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { signPublishAuth, type PublishAuth } from "@/lib/publish-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AUTH_MAX_AGE_MS = 14 * 60 * 1000;

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  connected: `0x${string}` | null;
  disabled?: boolean;
};

function authIsFresh(auth: PublishAuth): boolean {
  const ts = Number(auth.timestamp);
  return Number.isFinite(ts) && Date.now() - ts < AUTH_MAX_AGE_MS;
}

export function ArticleBodyEditor({ id, value, onChange, connected, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [publishAuth, setPublishAuth] = useState<PublishAuth | null>(null);

  const insertMarkdown = useCallback(
    (snippet: string) => {
      const el = textareaRef.current;
      if (!el) {
        onChange(value + snippet);
        return;
      }
      const { next, cursor } = insertTextAtCursor(
        value,
        el.selectionStart,
        el.selectionEnd,
        snippet,
      );
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = cursor;
        el.selectionEnd = cursor;
      });
    },
    [onChange, value],
  );

  const ensurePublishAuth = useCallback(async (): Promise<PublishAuth | null> => {
    if (publishAuth && authIsFresh(publishAuth)) return publishAuth;

    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum || !connected) {
      toast.error("Connect your wallet first");
      return null;
    }

    try {
      const auth = await signPublishAuth(ethereum, connected);
      setPublishAuth(auth);
      return auth;
    } catch (err) {
      if ((err as { code?: number }).code === 4001) {
        toast.message("Signature cancelled");
        return null;
      }
      toast.error("Could not authorize image upload", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      return null;
    }
  }, [connected, publishAuth]);

  const uploadAndInsert = useCallback(
    async (file: File) => {
      if (disabled || uploading) return;

      setUploading(true);
      try {
        const auth = await ensurePublishAuth();
        if (!auth) return;

        const result = await uploadArticleImage(file, auth);
        if (!result.ok) {
          toast.error("Image upload failed", { description: result.error });
          return;
        }

        insertMarkdown(imageMarkdownAtCursor(result.url));
        toast.success("Image inserted at cursor");
      } finally {
        setUploading(false);
      }
    },
    [disabled, ensurePublishAuth, insertMarkdown, uploading],
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const file = imageFileFromClipboard(event.clipboardData);
      if (!file) return;

      event.preventDefault();
      void uploadAndInsert(file);
    },
    [uploadAndInsert],
  );

  const onPickFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      await uploadAndInsert(file);
    },
    [uploadAndInsert],
  );

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="font-mono text-xs text-[#888]">
          Article body (paywalled)
        </Label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void onPickFile(e)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading || !connected}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 border-[#333] font-mono text-[10px] h-7"
          >
            {uploading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ImagePlus size={12} />
            )}
            Insert image
          </Button>
        </div>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-[#666]">
        Write normally — plain text works. Optional: **bold**, ## headings, lists. Paste a
        screenshot or image anywhere in the text; it lands at your cursor. Continue writing
        above or below.
      </p>

      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        rows={10}
        disabled={disabled || uploading}
        placeholder="Start your report here. Add images mid-article with paste (Ctrl+V) or Insert image."
        className={cn(
          "w-full rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-sm text-[#f5f5f5]",
          "placeholder:text-[#555] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
          uploading && "opacity-70",
        )}
      />
    </div>
  );
}