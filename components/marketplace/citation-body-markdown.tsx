"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="pt-1 text-base font-semibold tracking-wide text-[#f5f5f5]">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 border-t border-[#1f1f1f] pt-4 text-sm font-semibold tracking-wide text-[#f5f5f5] first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="pt-2 text-sm font-semibold tracking-wide text-[#e8e8e8]">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="font-mono text-xs leading-relaxed text-[#d4d4d4]">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#f5f5f5]">{children}</strong>
  ),
  em: ({ children }) => <em className="text-[#c8c8c8] italic">{children}</em>,
  hr: () => <hr className="my-4 border-[#1f1f1f]" />,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1.5 pl-5 font-mono text-xs text-[#d4d4d4]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1.5 pl-5 font-mono text-xs text-[#d4d4d4]">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children }) => {
    const isFence = Boolean(className?.includes("language-"));
    if (isFence) {
      return (
        <code className="block font-mono text-[11px] leading-relaxed text-[#d4d4d4]">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-[#1a1a1a] px-1 py-0.5 font-mono text-[11px] text-[#f5c842]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded border border-[#333] bg-[#0a0a0a] p-3">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[#f5c842] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#f5c842]/40 pl-3 font-mono text-xs italic text-[#888]">
      {children}
    </blockquote>
  ),
  img: ({ src, alt }) => (
    <span className="my-4 block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="max-h-[480px] w-full max-w-full rounded border border-[#333] bg-[#0a0a0a] object-contain"
      />
    </span>
  ),
};

type Props = {
  content: string;
  className?: string;
};

/** Renders paywalled article bodies: plain text, light Markdown, and inline images. */
export function CitationBodyMarkdown({ content, className }: Props) {
  return (
    <div className={cn("citation-body-markdown space-y-3", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}