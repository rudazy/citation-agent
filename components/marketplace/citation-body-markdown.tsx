"use client";

import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { MarkdownImage } from "@/components/marketplace/markdown-image";
import { MarkdownMermaid } from "@/components/marketplace/markdown-mermaid";
import { MarkdownSvg } from "@/components/marketplace/markdown-svg";
import { isMermaidLanguageClass } from "@/lib/article-mermaid";
import { fenceBareSvgsInMarkdown, isSvgLanguageClass } from "@/lib/article-svg";
import { cn } from "@/lib/utils";

function extractCodeText(children: ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractCodeText).join("");
  }
  if (typeof children === "object" && children !== null && "props" in children) {
    const el = children as { props?: { children?: ReactNode } };
    return extractCodeText(el.props?.children);
  }
  return "";
}

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
  // Unwrap pre so mermaid/svg (and other fences) control their own chrome.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const isFence = Boolean(className?.includes("language-"));
    if (isMermaidLanguageClass(className)) {
      return <MarkdownMermaid chart={extractCodeText(children)} />;
    }
    if (isSvgLanguageClass(className)) {
      return <MarkdownSvg source={extractCodeText(children)} />;
    }
    if (isFence) {
      return (
        <pre className="my-2 overflow-x-auto rounded border border-[#333] bg-[#0a0a0a] p-3">
          <code className="block font-mono text-[11px] leading-relaxed text-[#d4d4d4]">
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-[#1a1a1a] px-1 py-0.5 font-mono text-[11px] text-[#f5c842]">
        {children}
      </code>
    );
  },
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
  img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
  // GFM tables — structured like a proper report table (headers, borders, scroll).
  table: ({ children }) => (
    <div className="my-4 w-full overflow-x-auto rounded border border-[#333] bg-[#0a0a0a]">
      <table className="w-full min-w-[36rem] border-collapse text-left font-mono text-[11px] leading-relaxed">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-[#333] bg-[#141414]">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-[#1f1f1f]">{children}</tbody>,
  tr: ({ children }) => (
    <tr className="align-top transition-colors hover:bg-[#111]">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2.5 font-semibold tracking-wide text-[#f5f5f5]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="max-w-[14rem] px-3 py-2.5 text-[#d4d4d4] [overflow-wrap:anywhere]">
      {children}
    </td>
  ),
};

type Props = {
  content: string;
  className?: string;
};

/** Renders paywalled article bodies: Markdown, images, mermaid, and SVG figures. */
export function CitationBodyMarkdown({ content, className }: Props) {
  // Bare pasted <svg>…</svg> becomes a fence so it renders as a figure, not text.
  const normalized = fenceBareSvgsInMarkdown(content);

  return (
    <div className={cn("citation-body-markdown space-y-3", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={MARKDOWN_COMPONENTS}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
