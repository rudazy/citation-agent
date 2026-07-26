"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Compass, Loader2 } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { fetchWithRetry } from "@/lib/client-fetch";
import {
  CATALOG_TAG_QUERY_PARAM,
  getCatalogTagFromSearchParams,
} from "@/lib/post-share-url";
import { cn } from "@/lib/utils";

type SectorFacetPayload = {
  sector: string;
  label: string;
  post_count: number;
  signal_count: number;
  top_tags: string[];
};

/**
 * Niche discovery lane. Each sector deep-links into the catalog's existing tag
 * filter rather than introducing a parallel filtering system.
 */
export function SectorLanes() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = getCatalogTagFromSearchParams(searchParams);

  // Open by default when arriving on a ?tag= deep link, so the reader can see
  // which niche is filtering the catalog.
  const [expanded, setExpanded] = useState(Boolean(active));
  const [sectors, setSectors] = useState<SectorFacetPayload[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!expanded || sectors) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchWithRetry("/api/marketplace/demand?window=30d", {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = (await res.json()) as { sectors?: SectorFacetPayload[] };
        if (!cancelled) {
          setSectors(data.sectors ?? []);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, sectors]);

  // Routing through the URL keeps this unidirectional: the lane writes ?tag=,
  // the catalog reads it. Clicking an active tag clears the filter.
  const selectTag = useCallback(
    (tag: string) => {
      const next = active === tag ? null : tag;
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set(CATALOG_TAG_QUERY_PARAM, next);
      else params.delete(CATALOG_TAG_QUERY_PARAM);

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });

      document
        .getElementById("research-catalog")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [active, pathname, router, searchParams],
  );

  if (failed) return null;

  return (
    <Panel className="space-y-3 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
          <Compass size={18} className="text-[#f5c842]" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold tracking-wide">Browse by niche</h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
            {active
              ? `Filtering the catalog by ${active}.`
              : "Jump into a sector — L1/L2, DeFi, stablecoins, infrastructure, and more."}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "mt-1 shrink-0 text-[#888] transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded &&
        (loading && !sectors ? (
          <div className="flex items-center gap-2 border-t border-[#1f1f1f] py-3 pt-4 font-mono text-xs text-[#666]">
            <Loader2 size={14} className="animate-spin text-[#f5c842]" />
            Loading niches…
          </div>
        ) : !sectors?.length ? (
          <p className="border-t border-[#1f1f1f] pt-4 font-mono text-[11px] text-[#666]">
            Niches appear as research and signals are published.
          </p>
        ) : (
          <div className="space-y-3 border-t border-[#1f1f1f] pt-4">
            {sectors.map((facet) => (
            <div key={facet.sector} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-[11px] text-[#a3a3a3]">
                  {facet.label}
                </p>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#555]">
                  {facet.post_count}
                  {facet.signal_count > 0
                    ? ` · ${facet.signal_count} signal${facet.signal_count === 1 ? "" : "s"}`
                    : ""}
                </span>
              </div>
              {facet.top_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {facet.top_tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => selectTag(tag)}
                      className={cn(
                        "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                        active === tag
                          ? "border-[#f5c842]/40 bg-[#f5c842]/10 text-[#f5c842]"
                          : "border-[#1f1f1f] text-[#666] hover:border-[#333] hover:text-[#a3a3a3]",
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            ))}
          </div>
        ))}
    </Panel>
  );
}
