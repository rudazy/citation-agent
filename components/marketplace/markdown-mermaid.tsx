"use client";

import { useEffect, useId, useState } from "react";
import { GitBranch } from "lucide-react";
import { validateMermaidSource } from "@/lib/article-mermaid";
import { cn } from "@/lib/utils";

type Props = {
  chart: string;
  className?: string;
};

let mermaidConfigured = false;

/**
 * Renders a mermaid diagram from source text (strict security).
 * Used for ```mermaid fenced blocks in paywalled article bodies.
 */
export function MarkdownMermaid({ chart, className }: Props) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const source = chart.replace(/\n$/, "");
    const validationError = validateMermaidSource(source);

    if (validationError) {
      setError(validationError);
      setSvg(null);
      setLoading(false);
      return;
    }

    // Keep prior SVG while re-rendering so live preview does not flash empty.
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;

        if (!mermaidConfigured) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "dark",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            themeVariables: {
              darkMode: true,
              background: "#0a0a0a",
              primaryColor: "#1a1a1a",
              primaryTextColor: "#f5f5f5",
              primaryBorderColor: "#333333",
              secondaryColor: "#141414",
              tertiaryColor: "#111111",
              lineColor: "#666666",
              textColor: "#d4d4d4",
              mainBkg: "#1a1a1a",
              nodeBorder: "#333333",
              clusterBkg: "#111111",
              titleColor: "#f5f5f5",
              edgeLabelBackground: "#0a0a0a",
            },
          });
          mermaidConfigured = true;
        }

        // Unique id per render; mermaid mutates DOM by id during layout.
        const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, source.trim());

        if (!cancelled) {
          setSvg(rendered);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error && !svg) {
    return (
      <div
        className={cn(
          "my-4 space-y-2 rounded border border-[#333] bg-[#111] px-3 py-3",
          className,
        )}
      >
        <p className="flex items-center gap-2 font-mono text-[10px] text-[#888]">
          <GitBranch size={14} className="shrink-0 text-[#555]" />
          Diagram could not be rendered
          {error ? ` — ${error}` : ""}
        </p>
        <pre className="overflow-x-auto font-mono text-[10px] leading-relaxed text-[#555]">
          {chart.trim()}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={cn(
          "my-4 flex items-center gap-2 rounded border border-[#333] bg-[#0a0a0a] px-3 py-6 font-mono text-[10px] text-[#666]",
          className,
        )}
        role="status"
      >
        <GitBranch size={14} className="text-[#555]" />
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mermaid-diagram my-4 overflow-x-auto rounded border border-[#333] bg-[#0a0a0a] p-3 [&_svg]:mx-auto [&_svg]:max-w-full",
        loading && "opacity-80",
        className,
      )}
      // Mermaid SVG output; securityLevel "strict" encodes HTML and disables clicks.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
