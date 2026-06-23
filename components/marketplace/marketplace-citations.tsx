"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, FileText, Loader2, Shield } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AttestModal } from "@/components/attest";
import { AttestTrigger } from "@/components/attest/attest-trigger";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  payAndFetchScore,
  payWithSessionAgent,
  type PaidScoreResult,
} from "@/lib/trustgate-paid-client";
import { fetchAgentWalletStatus } from "@/lib/attestation-client";
import type { PaidTrustScore } from "@/lib/trustgate-paid";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import "@/lib/ethereum-provider";

type PayerChoice = "metamask" | "agent";

type TrustScore = {
  score: number;
  tier: string;
  confidence: number;
};

type CitationListing = {
  id: string;
  title: string;
  author: string;
  author_wallet?: `0x${string}`;
  price_usdc: string;
  tags: string[];
  excerpt: string;
  endpoint: string;
  token: string;
  trust?: TrustScore | null;
};

type ScoreCellState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; score: PaidTrustScore };

const SCORE_FEE_USDC = "0.001";

function formatTrust(trust: TrustScore | null | undefined): string | null {
  if (!trust) return null;
  const score = Math.round(trust.score);
  return trust.tier ? `TrustGate ${score} · ${trust.tier}` : `TrustGate ${score}`;
}

function formatPaidScore(score: PaidTrustScore): string {
  const parts = [`TrustGate ${Math.round(score.score)}`];
  if (score.tier) parts.push(score.tier);
  if (score.recommendation) parts.push(score.recommendation);
  return parts.join(" · ");
}

export function MarketplaceCitations() {
  const [listings, setListings] = useState<CitationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attestOpen, setAttestOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");
  const [scoreStates, setScoreStates] = useState<Record<string, ScoreCellState>>({});
  const [metamaskAvailable, setMetamaskAvailable] = useState(false);
  const [agentFunded, setAgentFunded] = useState(false);

  useEffect(() => {
    setMetamaskAvailable(typeof window !== "undefined" && Boolean(window.ethereum));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchAgentWalletStatus();
        if (cancelled) return;
        const funded =
          status.configured &&
          status.usdcBalance != null &&
          Number(status.usdcBalance) >= Number(SCORE_FEE_USDC);
        setAgentFunded(funded);
      } catch {
        if (!cancelled) setAgentFunded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openAttest = useCallback((target: string) => {
    setCurrentTarget(target);
    setAttestOpen(true);
  }, []);

  const setCell = useCallback((id: string, state: ScoreCellState) => {
    setScoreStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const runLookup = useCallback(
    async (item: CitationListing, payer: PayerChoice) => {
      const wallet = item.author_wallet;
      if (!wallet) {
        toast.error("No author wallet on this citation");
        return;
      }

      setCell(item.id, { status: "loading" });
      try {
        let result: PaidScoreResult;
        if (payer === "metamask") {
          const ethereum: EthereumProvider | undefined = window.ethereum;
          if (!ethereum) {
            setCell(item.id, { status: "idle" });
            toast.error("MetaMask not detected");
            return;
          }
          const accounts = (await ethereum.request({
            method: "eth_requestAccounts",
          })) as string[];
          const account = accounts?.[0] as `0x${string}` | undefined;
          if (!account) {
            setCell(item.id, { status: "idle" });
            return;
          }
          result = await payAndFetchScore({ address: wallet, ethereum, account });
        } else {
          // Session agent wallet pays server side.
          result = await payWithSessionAgent(wallet);
        }

        switch (result.status) {
          case "ok":
            setCell(item.id, { status: "done", score: result.score });
            toast.success("Trust score revealed", {
              description: formatPaidScore(result.score),
            });
            break;
          case "cached": {
            const score = result.score;
            if (score) {
              setCell(item.id, { status: "done", score });
            } else {
              setCell(item.id, { status: "idle" });
              toast.message("No score available for this wallet yet");
            }
            break;
          }
          case "cancelled":
            setCell(item.id, { status: "idle" });
            toast.message("Payment cancelled, no charge");
            break;
          case "unconfigured":
            setCell(item.id, { status: "idle" });
            toast.error("Trust scoring is not configured");
            break;
          case "failed":
            setCell(item.id, { status: "idle" });
            toast.error("Trust score lookup failed", { description: result.reason });
            break;
        }
      } catch (err) {
        setCell(item.id, { status: "idle" });
        if ((err as { code?: number }).code !== 4001) {
          toast.error("Could not check trust score", {
            description: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    },
    [setCell],
  );

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
                  <p className="font-mono text-xs text-[#666]">
                    {item.author}
                    {(() => {
                      const cell = scoreStates[item.id];
                      const text =
                        cell?.status === "done"
                          ? formatPaidScore(cell.score)
                          : formatTrust(item.trust);
                      return text ? <span className="ml-2 text-[#888]">· {text}</span> : null;
                    })()}
                  </p>
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
                  {scoreStates[item.id]?.status !== "done" &&
                    (() => {
                      const loading = scoreStates[item.id]?.status === "loading";
                      const disabled = loading || !item.author_wallet;
                      const defaultPayer: PayerChoice = metamaskAvailable ? "metamask" : "agent";
                      const mainButton = (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => void runLookup(item, defaultPayer)}
                          className={cn(
                            "gap-1.5 border-[#ff8a3d]/30 text-[#ff8a3d] hover:bg-[#ff8a3d]/10 hover:text-[#ff8a3d]",
                          )}
                        >
                          {loading ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Checking…
                            </>
                          ) : (
                            <>
                              <Shield size={14} />
                              Check trust score ({SCORE_FEE_USDC} USDC)
                            </>
                          )}
                        </Button>
                      );

                      // Only when both payers are available does the user get to choose.
                      // The plain button keeps paying with MetaMask by default.
                      if (!(metamaskAvailable && agentFunded)) return mainButton;

                      return (
                        <div className="flex items-center gap-1">
                          {mainButton}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={disabled}
                                aria-label="Choose payer"
                                className={cn(
                                  "px-2 border-[#ff8a3d]/30 text-[#ff8a3d] hover:bg-[#ff8a3d]/10 hover:text-[#ff8a3d]",
                                )}
                              >
                                <ChevronDown size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void runLookup(item, "metamask")}>
                                Pay with MetaMask
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void runLookup(item, "agent")}>
                                Pay with agent wallet
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })()}
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