"use client";

import { ImageOff } from "lucide-react";
import { sanitizeSvgSource, validateSvgSource } from "@/lib/article-svg";
import { cn } from "@/lib/utils";

type Props = {
  source: string;
  className?: string;
};

/**
 * Renders author SVG from a ```svg fence (or normalized bare SVG).
 * Sanitizes scripts/handlers; scales to container width.
 */
export function MarkdownSvg({ source, className }: Props) {
  const validationError = validateSvgSource(source);
  const sanitized = validationError ? null : sanitizeSvgSource(source);

  if (!sanitized) {
    return (
      <div
        className={cn(
          "my-4 space-y-2 rounded border border-[#333] bg-[#111] px-3 py-3",
          className,
        )}
      >
        <p className="flex items-center gap-2 font-mono text-[10px] text-[#888]">
          <ImageOff size={14} className="shrink-0 text-[#555]" />
          SVG could not be rendered
          {validationError ? ` — ${validationError}` : ""}
        </p>
        <pre className="max-h-40 overflow-auto font-mono text-[10px] leading-relaxed text-[#555]">
          {source.trim().slice(0, 800)}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "markdown-svg my-4 w-full overflow-x-auto rounded border border-[#333] bg-[#0a0a0a] p-2",
        "[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full",
        className,
      )}
      // Sanitized SVG markup only (scripts/handlers stripped).
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
