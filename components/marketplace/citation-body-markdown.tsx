"use client";

import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MarkdownCodeBlock } from "@/components/marketplace/markdown-code-block";
import { MarkdownImage } from "@/components/marketplace/markdown-image";
import { MarkdownMermaid } from "@/components/marketplace/markdown-mermaid";
import { MarkdownSvg } from "@/components/marketplace/markdown-svg";
import { plainMathInFootnoteDefinitions } from "@/lib/article-math";
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

/** Fenced block vs inline: language-* / hljs from highlight, or multi-line body. */
function isFencedCode(className: string | undefined, children: ReactNode): boolean {
  if (className?.includes("language-") || className?.includes("hljs")) return true;
  const text = extractCodeText(children);
  return text.includes("\n");
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="pt-1 text-base font-semibold tracking-wide text-[#f5f5f5]">{children}</h1>
  ),
  h2: ({ children, id }) => {
    // GFM footnotes emit <h2 id="footnote-label"> — render as a small reference label.
    if (id === "footnote-label") {
      return (
        <h2 id={id} className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#666]">
          {children}
        </h2>
      );
    }
    return (
      <h2 className="mt-4 border-t border-[#1f1f1f] pt-4 text-sm font-semibold tracking-wide text-[#f5f5f5] first:mt-0 first:border-t-0 first:pt-0">
        {children}
      </h2>
    );
  },
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
  // Keep the generated id — GFM footnote jump links (#user-content-fn-N) need it.
  li: ({ children, id, className }) => (
    <li id={id} className={cn("leading-relaxed", className)}>
      {children}
    </li>
  ),
  sup: ({ children }) => (
    <sup className="ml-0.5 font-mono text-[10px] text-[#f5c842]">{children}</sup>
  ),
  section: ({ children, className, ...props }) => {
    // GFM footnotes arrive as <section data-footnotes class="footnotes">.
    // React may surface the flag as data-footnotes or dataFootnotes; className
    // may be a string or string[] depending on the hast→jsx path.
    const classTokens = Array.isArray(className)
      ? className
      : typeof className === "string"
        ? className.split(/\s+/).filter(Boolean)
        : [];
    const isFootnotes =
      "data-footnotes" in props ||
      "dataFootnotes" in props ||
      classTokens.includes("footnotes");
    if (isFootnotes) {
      return (
        <section
          data-footnotes=""
          className="citation-footnotes mt-6 border-t border-[#1f1f1f] pt-4 text-xs text-[#d4d4d4] [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-5 [&_ol_p]:my-0 [&_ol_p]:leading-relaxed"
        >
          {children}
        </section>
      );
    }
    return (
      <section className={Array.isArray(className) ? className.join(" ") : className}>
        {children}
      </section>
    );
  },
  // Unwrap pre so mermaid/svg/code chrome control their own wrapper.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    if (isMermaidLanguageClass(className)) {
      return <MarkdownMermaid chart={extractCodeText(children)} />;
    }
    if (isSvgLanguageClass(className)) {
      return <MarkdownSvg source={extractCodeText(children)} />;
    }
    if (isFencedCode(className, children)) {
      return <MarkdownCodeBlock className={className}>{children}</MarkdownCodeBlock>;
    }
    return (
      <code className="rounded bg-[#1a1a1a] px-1 py-0.5 font-mono text-[11px] text-[#f5c842]">
        {children}
      </code>
    );
  },
  a: ({ href, children, id, className }) => {
    // In-page anchors (footnote refs/backrefs) must not open a new tab.
    if (href?.startsWith("#")) {
      return (
        <a
          id={id}
          href={href}
          className={cn("text-[#f5c842] no-underline hover:underline", className)}
        >
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[#f5c842] underline-offset-2 hover:underline"
      >
        {children}
      </a>
    );
  },
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
  // Footnote $math$ → plain unicode so fn #1 (fee ratio) always stays readable.
  const normalized = plainMathInFootnoteDefinitions(fenceBareSvgsInMarkdown(content));

  return (
    <div className={cn("citation-body-markdown space-y-3", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        // KaTeX: html-only (no MathML). Body $…$ / $$…$$ still render as formulas.
        // Footnote definitions are pre-flattened to plain text (see article-math).
        // Highlight tokenizes fenced code (mermaid/svg pass through as unknown langs).
        rehypePlugins={[
          [rehypeKatex, { output: "html", throwOnError: false, strict: "ignore" }],
          rehypeHighlight,
        ]}
        components={MARKDOWN_COMPONENTS}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
