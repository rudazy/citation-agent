"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  children: ReactNode;
};

function languageFromClassName(className?: string): string | null {
  if (!className) return null;
  const match = /language-([a-z0-9_+-]+)/i.exec(className);
  if (!match) return null;
  const lang = match[1].toLowerCase();
  // Internal fence languages get dedicated renderers — never show as a badge.
  if (lang === "mermaid" || lang === "svg") return null;
  return lang;
}

function extractPlainText(children: ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractPlainText).join("");
  }
  if (typeof children === "object" && children !== null && "props" in children) {
    const el = children as { props?: { children?: ReactNode } };
    return extractPlainText(el.props?.children);
  }
  return "";
}

/**
 * Fenced code block chrome: language label + one-click copy.
 * Token spans from rehype-highlight stay as children; we keep hljs classes.
 */
export function MarkdownCodeBlock({ className, children }: Props) {
  const [copied, setCopied] = useState(false);
  const language = languageFromClassName(className);
  const plain = extractPlainText(children).replace(/\n$/, "");

  const onCopy = useCallback(async () => {
    if (!plain) return;
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [plain]);

  return (
    <div className="group relative my-2 overflow-hidden rounded border border-[#333] bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-2 border-b border-[#1f1f1f] bg-[#111] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#666]">
          {language ?? "code"}
        </span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className={cn(
            "inline-flex items-center gap-1 rounded border border-[#2a2a2a] bg-[#141414] px-1.5 py-0.5 font-mono text-[10px] text-[#888] transition-colors",
            "hover:border-[#f5c842]/35 hover:text-[#f5f5f5]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/50",
          )}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check size={10} className="text-[#c8f135]" />
              <span className="text-[#c8f135]">Copied</span>
            </>
          ) : (
            <>
              <Copy size={10} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code
          className={cn(
            "block font-mono text-[11px] leading-relaxed text-[#d4d4d4]",
            className,
          )}
        >
          {children}
        </code>
      </pre>
    </div>
  );
}
