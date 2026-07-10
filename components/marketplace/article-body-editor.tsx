"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, GitBranch, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CitationBodyMarkdown } from "@/components/marketplace/citation-body-markdown";
import { imageMarkdownAtCursor, insertTextAtCursor } from "@/lib/article-image";
import { imageFileFromClipboard, uploadArticleImage } from "@/lib/article-image-upload";
import { mermaidMarkdownAtCursor } from "@/lib/article-mermaid";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { signArticleImageUploadAuth } from "@/lib/publish-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Debounce live preview so mermaid does not re-render on every keystroke. */
const PREVIEW_DEBOUNCE_MS = 350;

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  connected: `0x${string}` | null;
  disabled?: boolean;
};

export function ArticleBodyEditor({ id, value, onChange, connected, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewPanelId = useId();
  const [uploading, setUploading] = useState(false);
  /** Collapsed by default so authors can write without the preview taking space. */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(value);

  useEffect(() => {
    if (!previewOpen) return;
    const timer = window.setTimeout(() => setPreview(value), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, previewOpen]);

  const togglePreview = useCallback(() => {
    setPreviewOpen((open) => {
      if (!open) {
        // Sync immediately when expanding so the first paint matches the textarea.
        setPreview(value);
      }
      return !open;
    });
  }, [value]);

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

  const uploadAndInsert = useCallback(
    async (file: File) => {
      if (disabled || uploading) return;

      const ethereum: EthereumProvider | undefined = window.ethereum;
      if (!ethereum || !connected) {
        toast.error("Connect your wallet first");
        return;
      }

      setUploading(true);
      try {
        let auth;
        try {
          auth = await signArticleImageUploadAuth(ethereum, connected, file);
        } catch (err) {
          if ((err as { code?: number }).code === 4001) {
            toast.message("Signature cancelled");
            return;
          }
          toast.error("Could not authorize image upload", {
            description: err instanceof Error ? err.message : "Unknown error",
          });
          return;
        }

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
    [connected, disabled, insertMarkdown, uploading],
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

  const insertDiagram = useCallback(() => {
    if (disabled || uploading) return;
    insertMarkdown(mermaidMarkdownAtCursor());
    toast.success("Diagram block inserted — expand Live preview to check the chart");
  }, [disabled, insertMarkdown, uploading]);

  const trimmedPreview = preview.trim();

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="font-mono text-xs text-[#888]">
          Article body (paywalled)
        </Label>
        <div className="flex flex-wrap items-center gap-2">
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
            disabled={disabled || uploading}
            onClick={insertDiagram}
            className="h-7 gap-1.5 border-[#333] font-mono text-[10px]"
          >
            <GitBranch size={12} />
            Insert diagram
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading || !connected}
            onClick={() => fileInputRef.current?.click()}
            className="h-7 gap-1.5 border-[#333] font-mono text-[10px]"
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
        Write or paste below. Expand{" "}
        <span className="text-[#888]">Live preview</span> only when you want to check
        diagrams, images, or markdown before posting.
      </p>

      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        rows={10}
        disabled={disabled || uploading}
        placeholder="Start your report here. Paste mermaid fences or images at the cursor."
        className={cn(
          "w-full rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-sm text-[#f5f5f5]",
          "placeholder:text-[#555] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
          uploading && "opacity-70",
        )}
      />

      <div className="rounded border border-[#333] bg-[#0a0a0a]">
        <button
          type="button"
          onClick={togglePreview}
          aria-expanded={previewOpen}
          aria-controls={previewPanelId}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left",
            "font-mono text-[10px] uppercase tracking-wide text-[#888]",
            "transition-colors hover:bg-[#111] hover:text-[#f5f5f5]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
          )}
        >
          <span>Live preview</span>
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 text-[#666] transition-transform duration-150",
              previewOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {previewOpen ? (
          <div
            id={previewPanelId}
            className={cn(
              "border-t border-[#1f1f1f] px-3 py-3",
              !trimmedPreview && "flex min-h-[80px] items-center",
            )}
            aria-live="polite"
          >
            {trimmedPreview ? (
              <CitationBodyMarkdown content={preview} />
            ) : (
              <p className="font-mono text-[10px] text-[#555]">
                Preview appears here when you add body text, images, or a mermaid diagram.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
