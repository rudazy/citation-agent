"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Bold,
  ChevronDown,
  Code,
  FileText,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Loader2,
  Quote,
  Sigma,
  Superscript,
  Table,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CitationBodyMarkdown } from "@/components/marketplace/citation-body-markdown";
import {
  FORMULA_BLOCK_SNIPPET,
  insertFootnote,
  prefixSelectedLines,
  REPORT_TEMPLATE,
  TABLE_SNIPPET,
  wrapSelection,
  type FormatResult,
} from "@/lib/article-format";
import { imageMarkdownAtCursor, insertTextAtCursor } from "@/lib/article-image";
import { imageFileFromClipboard, uploadArticleImage } from "@/lib/article-image-upload";
import { isSvgDocument, svgMarkdownAtCursor } from "@/lib/article-svg";
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
      if (file) {
        event.preventDefault();
        void uploadAndInsert(file);
        return;
      }

      // Raw SVG paste → fence so live preview / unlock view render the figure.
      const text = event.clipboardData.getData("text/plain");
      if (text && isSvgDocument(text)) {
        event.preventDefault();
        insertMarkdown(svgMarkdownAtCursor(text));
        toast.success("SVG figure inserted — expand Live preview to check it");
      }
    },
    [insertMarkdown, uploadAndInsert],
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

  /** Apply a selection-aware formatter and restore focus/selection. */
  const applyFormat = useCallback(
    (format: (value: string, start: number, end: number) => FormatResult) => {
      if (disabled || uploading) return;
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const { next, selStart, selEnd } = format(value, start, end);
      onChange(next);
      requestAnimationFrame(() => {
        el?.focus();
        if (el) {
          el.selectionStart = selStart;
          el.selectionEnd = selEnd;
        }
      });
    },
    [disabled, onChange, uploading, value],
  );

  const insertTemplate = useCallback(() => {
    if (disabled || uploading) return;
    if (value.trim() && !window.confirm("Replace the current draft with the report template?")) {
      return;
    }
    onChange(REPORT_TEMPLATE);
    setPreview(REPORT_TEMPLATE);
    toast.success("Report template loaded. Replace each section with your research");
  }, [disabled, onChange, uploading, value]);

  const formatActions: {
    label: string;
    icon: typeof Bold;
    run: () => void;
  }[] = [
    {
      label: "Bold",
      icon: Bold,
      run: () => applyFormat((v, s, e) => wrapSelection(v, s, e, "**", "**", "bold text")),
    },
    {
      label: "Italic",
      icon: Italic,
      run: () => applyFormat((v, s, e) => wrapSelection(v, s, e, "_", "_", "italic text")),
    },
    {
      label: "Heading",
      icon: Heading2,
      run: () => applyFormat((v, s, e) => prefixSelectedLines(v, s, e, "## ")),
    },
    {
      label: "Link",
      icon: Link2,
      run: () =>
        applyFormat((v, s, e) => wrapSelection(v, s, e, "[", "](https://)", "link text")),
    },
    {
      label: "Inline code",
      icon: Code,
      run: () => applyFormat((v, s, e) => wrapSelection(v, s, e, "`", "`", "code")),
    },
    {
      label: "Quote",
      icon: Quote,
      run: () => applyFormat((v, s, e) => prefixSelectedLines(v, s, e, "> ")),
    },
    {
      label: "Bullet list",
      icon: List,
      run: () => applyFormat((v, s, e) => prefixSelectedLines(v, s, e, "- ")),
    },
    {
      label: "Table",
      icon: Table,
      run: () => insertMarkdown(TABLE_SNIPPET),
    },
    {
      label: "Formula (LaTeX)",
      icon: Sigma,
      run: () => insertMarkdown(FORMULA_BLOCK_SNIPPET),
    },
    {
      label: "Footnote",
      icon: Superscript,
      run: () => applyFormat(insertFootnote),
    },
  ];

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
            onClick={insertTemplate}
            className="h-7 gap-1.5 border-[#333] font-mono text-[10px]"
          >
            <FileText size={12} />
            Start from template
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
        Write or paste below. Formulas render with LaTeX ($$…$$), footnotes with [^1],
        and code blocks get syntax highlighting. Paste SVG source or images for figures;
        mermaid fences for flowcharts. Expand{" "}
        <span className="text-[#888]">Live preview</span> to check how it looks.
      </p>

      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1 rounded border border-[#1f1f1f] bg-[#0d0d0d] px-1.5 py-1"
      >
        {formatActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              title={action.label}
              aria-label={action.label}
              disabled={disabled || uploading}
              onClick={action.run}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded text-[#888]",
                "transition-colors hover:bg-[#1a1a1a] hover:text-[#f5f5f5]",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
                "disabled:opacity-40",
              )}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        rows={10}
        disabled={disabled || uploading}
        placeholder="Start your report here. Paste mermaid, SVG, or images at the cursor."
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
