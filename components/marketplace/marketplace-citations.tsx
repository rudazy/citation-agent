"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { AttestModal } from "@/components/attest";
import { AttestTrigger } from "@/components/attest/attest-trigger";

type CitationListing = {
  id: string;
  title: string;
  author: string;
  price_usdc: string;
  tags: string[];
  excerpt: string;
  endpoint: string;
  token: string;
};

export function MarketplaceCitations() {
  const [listings, setListings] = useState<CitationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attestOpen, setAttestOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");

  const openAttest = useCallback((target: string) => {
    setCurrentTarget(target);
    setAttestOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/marketplace/citations");
        if (!res.ok) throw new Error(`Failed to load citations (${res.status})`);
        const data = (await res.json()) as { listings?: CitationListing[] };
        if (!cancelled) setListings(data.listings ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load citations");
          setListings([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Panel glow className="space-y-4 p-4 sm:p-5 border-[#f5c842]/20">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
            <FileText size={18} className="text-[#f5c842]" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold tracking-wide">Citation catalog</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
              Paywalled creator sources. Stake USDC attestations on any citation or author to
              signal trust on-chain.
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground font-mono">
            <Loader2 size={16} className="animate-spin text-[#f5c842]" />
            Loading citations…
          </div>
        )}

        {error && (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && listings.length === 0 && (
          <p className="py-8 text-center font-mono text-sm text-muted-foreground">
            No citation listings found.
          </p>
        )}

        <div className="grid gap-3">
          {listings.map((item) => (
            <article
              key={item.id}
              className="rounded border border-[#1f1f1f] bg-[#111]/80 p-4 transition-colors hover:border-[#f5c842]/25"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-[#141414] px-2 py-0.5 font-mono text-[10px] text-[#888]">
                      {item.id}
                    </code>
                    <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
                      ${item.price_usdc} {item.token}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
                    {item.title}
                  </h3>
                  <p className="font-mono text-xs text-[#666]">{item.author}</p>
                  <p className="font-mono text-xs leading-relaxed text-[#888] line-clamp-2">
                    {item.excerpt}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-[#141414] text-[#a3a3a3] border border-[#2a2a2a] hover:bg-[#141414] text-[10px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <AttestTrigger
                    target={`citation:${item.id}`}
                    onAttest={openAttest}
                    label="Attest citation"
                  />
                  <AttestTrigger
                    target={`author:${item.author}`}
                    onAttest={openAttest}
                    label="Attest author"
                    variant="ghost"
                    className="text-[#888] hover:text-[#f5c842] border-transparent"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <AttestModal
        isOpen={attestOpen}
        onClose={() => setAttestOpen(false)}
        target={currentTarget}
      />
    </>
  );
}