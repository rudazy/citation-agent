"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, FileText, Loader2, LockOpen, Shield, Users } from "lucide-react";
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
import {
  TrustSignalBadge,
  type PublicTrustSignal,
} from "@/components/marketplace/trust-signal";
import {
  fetchAgentWalletStatus,
  getConnectedAccount,
  switchToArcTestnet,
} from "@/lib/attestation-client";
import {
  unlockCitationViaAgent,
  unlockCitationViaMetaMask,
} from "@/lib/citation-unlock-client";
import {
  payAndFetchTrustByPostId,
  payTrustByPostIdWithAgent,
} from "@/lib/trustgate-post-client";
import { selectTrustForPost } from "@/lib/trust-display";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import "@/lib/ethereum-provider";

type PayerChoice = "metamask" | "agent";

type CitationListing = {
  id: string;
  title: string;
  author: string;
  price_usdc: string;
  tags: string[];
  subheading: string;
  paid_count: number;
  endpoint: string;
  token: string;
  trust?: PublicTrustSignal | null;
  trust_paid_lookup?: boolean;
};

type ExpandState =
  | { status: "locked" }
  | { status: "loading" }
  | { status: "unlocked"; body: string };

type TrustCellState =
  | { status: "idle"; trust: PublicTrustSignal | null }
  | { status: "loading"; trust: PublicTrustSignal | null }
  | { status: "done"; trust: PublicTrustSignal | null };

const PAID_TRUST_FEE = "0.001";

function paidCountLabel(count: number): string {
  if (count === 0) return "0 paid unlocks";
  if (count === 1) return "1 reader paid";
  return `${count} readers paid`;
}

type Props = {
  refreshKey?: number;
};

export function MarketplaceCitations({ refreshKey = 0 }: Props) {
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [listings, setListings] = useState<CitationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attestOpen, setAttestOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");
  const [expandStates, setExpandStates] = useState<Record<string, ExpandState>>({});
  const [trustStates, setTrustStates] = useState<Record<string, TrustCellState>>({});
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
        setAgentFunded(status.configured && status.paymentReady === true);
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

  const setExpand = useCallback((id: string, state: ExpandState) => {
    setExpandStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const bumpPaidCount = useCallback((id: string) => {
    setListings((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, paid_count: item.paid_count + 1 } : item,
      ),
    );
  }, []);

  const getTrustState = useCallback(
    (item: CitationListing): TrustCellState => {
      return (
        trustStates[item.id] ?? {
          status: "idle",
          trust: item.trust ?? null,
        }
      );
    },
    [trustStates],
  );

  const runTrustLookup = useCallback(
    async (item: CitationListing, payer: PayerChoice) => {
      const prior = getTrustState(item);
      if (prior.status === "done" && prior.trust?.source === "paid") return;

      setTrustStates((prev) => ({
        ...prev,
        [item.id]: { status: "loading", trust: prior.trust },
      }));

      try {
        let result;
        if (payer === "metamask") {
          const ethereum: EthereumProvider | undefined = window.ethereum;
          if (!ethereum) {
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: { status: "idle", trust: prior.trust },
            }));
            toast.error("MetaMask not detected");
            return;
          }
          await switchToArcTestnet(ethereum);
          const account = await getConnectedAccount(ethereum);
          result = await payAndFetchTrustByPostId({
            postId: item.id,
            ethereum,
            account,
          });
        } else {
          result = await payTrustByPostIdWithAgent(item.id);
        }

        switch (result.status) {
          case "ok":
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: { status: "done", trust: result.trust },
            }));
            toast.success("Trust score updated", {
              description: `TrustGate ${result.trust.score}${result.trust.tier ? ` · ${result.trust.tier}` : ""}`,
            });
            break;
          case "cached":
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: {
                status: "done",
                trust: result.trust ?? prior.trust,
              },
            }));
            if (result.trust) {
              toast.message("Using cached trust score");
            } else {
              toast.message("No score available for this creator yet");
            }
            break;
          case "cancelled":
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: { status: "idle", trust: prior.trust },
            }));
            toast.message("Payment cancelled, no charge");
            break;
          case "unconfigured":
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: { status: "idle", trust: prior.trust },
            }));
            toast.error("Trust scoring is not configured");
            break;
          case "failed":
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: { status: "idle", trust: prior.trust },
            }));
            toast.error("Trust lookup failed", { description: result.reason });
            break;
        }
      } catch (err) {
        setTrustStates((prev) => ({
          ...prev,
          [item.id]: { status: "idle", trust: prior.trust },
        }));
        toast.error("Could not check trust score", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [getTrustState],
  );

  const runUnlock = useCallback(
    async (item: CitationListing, payer: PayerChoice) => {
      const current = expandStates[item.id];
      if (current?.status === "unlocked") return;

      setExpand(item.id, { status: "loading" });

      try {
        let result;
        if (payer === "metamask") {
          const ethereum: EthereumProvider | undefined = window.ethereum;
          if (!ethereum) {
            setExpand(item.id, { status: "locked" });
            toast.error("MetaMask not detected");
            return;
          }
          await switchToArcTestnet(ethereum);
          const account = await getConnectedAccount(ethereum);
          result = await unlockCitationViaMetaMask({
            listingId: item.id,
            author: item.author,
            account,
            ethereum,
          });
        } else {
          result = await unlockCitationViaAgent({
            listingId: item.id,
            author: item.author,
          });
        }

        switch (result.status) {
          case "ok":
            setExpand(item.id, { status: "unlocked", body: result.body });
            bumpPaidCount(item.id);
            toast.success("Content unlocked", {
              description: result.amountUsdc
                ? `Paid ${result.amountUsdc} USDC`
                : `$${item.price_usdc} USDC`,
            });
            break;
          case "cancelled":
            setExpand(item.id, { status: "locked" });
            toast.message("Payment cancelled, no charge");
            break;
          case "failed":
            setExpand(item.id, { status: "locked" });
            toast.error("Could not unlock content", { description: result.reason });
            break;
        }
      } catch (err) {
        setExpand(item.id, { status: "locked" });
        toast.error("Unlock failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [bumpPaidCount, setExpand],
  );

  const loadListings = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/citations", { signal });
      if (!res.ok) throw new Error(`Failed to load citations (${res.status})`);
      const data = (await res.json()) as { listings?: CitationListing[] };
      const rows = data.listings ?? [];
      setListings(rows);
      setTrustStates((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (!next[row.id]) {
            next[row.id] = { status: "idle", trust: row.trust ?? null };
          }
        }
        return next;
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load citations");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadListings(controller.signal);
    return () => controller.abort();
  }, [loadListings, refreshKey]);

  return (
    <>
      <Panel glow className="space-y-4 p-4 sm:p-5 border-[#f5c842]/20">
        <button
          type="button"
          onClick={() => setSectionExpanded((v) => !v)}
          aria-expanded={sectionExpanded}
          className="flex w-full items-start gap-3 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
            <FileText size={18} className="text-[#f5c842]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold tracking-wide">Citation catalog</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
              Trust scores reflect the creator identity wallet (hidden). Expand unlocks the body.
              Paid unlock counts sit on each subheading.
            </p>
          </div>
          <ChevronDown
            size={18}
            className={cn(
              "mt-1 shrink-0 text-[#888] transition-transform",
              sectionExpanded && "rotate-180",
            )}
          />
        </button>

        {sectionExpanded && loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground font-mono">
            <Loader2 size={16} className="animate-spin text-[#f5c842]" />
            Loading citations…
          </div>
        )}

        {sectionExpanded && error && (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        {sectionExpanded && !loading && !error && listings.length === 0 && (
          <p className="py-8 text-center font-mono text-sm text-muted-foreground">
            No citation listings yet. Publish the first post above.
          </p>
        )}

        {sectionExpanded && (
        <div className="grid gap-3">
          {listings.map((item) => {
            const expand = expandStates[item.id] ?? { status: "locked" };
            const isUnlocked = expand.status === "unlocked";
            const isUnlockLoading = expand.status === "loading";
            const trustCell = getTrustState(item);
            // Bind display strictly to this post: a score only ever renders on the
            // card it was fetched for. A foreign/unstamped signal renders Unscored,
            // so a paid score can never leak onto another post's card.
            const displayTrust = selectTrustForPost(item.id, trustCell.trust);
            const trustLoading = trustCell.status === "loading";
            const paidTrustDone = trustCell.status === "done" && displayTrust?.source === "paid";
            const defaultPayer: PayerChoice = metamaskAvailable ? "metamask" : "agent";
            const canChoosePayer = metamaskAvailable && agentFunded;
            const showPaidTrust =
              item.trust_paid_lookup && !paidTrustDone && displayTrust?.source !== "paid";

            const expandButton = (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUnlockLoading || isUnlocked}
                onClick={() => void runUnlock(item, defaultPayer)}
                className={cn(
                  "gap-1.5 border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10 hover:text-[#f5c842]",
                )}
              >
                {isUnlockLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Paying…
                  </>
                ) : isUnlocked ? (
                  <>
                    <LockOpen size={14} />
                    Unlocked
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    Expand (${item.price_usdc} USDC)
                  </>
                )}
              </Button>
            );

            const trustButton = showPaidTrust ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={trustLoading}
                onClick={() => void runTrustLookup(item, defaultPayer)}
                className="gap-1.5 border-[#ff8a3d]/30 text-[#ff8a3d] hover:bg-[#ff8a3d]/10"
              >
                {trustLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Checking…
                  </>
                ) : (
                  <>
                    <Shield size={14} />
                    Refresh trust ({PAID_TRUST_FEE} USDC)
                  </>
                )}
              </Button>
            ) : null;

            return (
              <article
                key={item.id}
                className="rounded border border-[#1f1f1f] bg-[#111]/80 p-4 transition-colors hover:border-[#f5c842]/25"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-[#141414] px-2 py-0.5 font-mono text-[10px] text-[#888]">
                        {item.id}
                      </code>
                      <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
                        ${item.price_usdc} {item.token}
                      </Badge>
                      <TrustSignalBadge trust={displayTrust} />
                    </div>
                    <h3 className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
                      {item.title}
                    </h3>
                    <p className="font-mono text-xs text-[#666]">{item.author}</p>

                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#888]">
                        <Users size={10} className="text-[#666]" />
                        {paidCountLabel(item.paid_count)}
                      </span>
                      <p className="font-mono text-xs leading-relaxed text-[#888]">
                        {item.subheading}
                      </p>
                    </div>

                    {isUnlocked && (
                      <div className="rounded border border-[#f5c842]/20 bg-[#0a0a0a] px-3 py-3">
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#f5c842]/80">
                          Full content
                        </p>
                        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#d4d4d4]">
                          {expand.body}
                        </p>
                      </div>
                    )}

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
                    {canChoosePayer ? (
                      <div className="flex items-center gap-1">
                        {expandButton}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUnlockLoading || isUnlocked}
                              aria-label="Choose unlock payer"
                              className="px-2 border-[#f5c842]/35 text-[#f5c842]"
                            >
                              <ChevronDown size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void runUnlock(item, "metamask")}>
                              Pay with MetaMask
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void runUnlock(item, "agent")}>
                              Pay with agent wallet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      expandButton
                    )}
                    {trustButton &&
                      (canChoosePayer ? (
                        <div className="flex items-center gap-1">
                          {trustButton}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={trustLoading}
                                aria-label="Choose trust payer"
                                className="px-2 border-[#ff8a3d]/30 text-[#ff8a3d]"
                              >
                                <ChevronDown size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => void runTrustLookup(item, "metamask")}
                              >
                                Pay with MetaMask
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void runTrustLookup(item, "agent")}
                              >
                                Pay with agent wallet
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                        trustButton
                      ))}
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
            );
          })}
        </div>
        )}
      </Panel>

      <AttestModal
        isOpen={attestOpen}
        onClose={() => setAttestOpen(false)}
        target={currentTarget}
      />
    </>
  );
}