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
import { BackingHint } from "@/components/marketplace/backing-hint";
import {
  TrustSignalBadge,
  type PublicTrustSignal,
} from "@/components/marketplace/trust-signal";
import type { ResearchBackingStats } from "@/lib/research-backing";
import { getConnectedAccount, switchToArcTestnet } from "@/lib/attestation-client";
import {
  unlockCitationViaAgent,
  unlockCitationViaMetaMask,
} from "@/lib/citation-unlock-client";
import {
  payAndFetchTrustByPostId,
  payTrustByPostIdWithAgent,
} from "@/lib/trustgate-post-client";
import { selectTrustForPost } from "@/lib/trust-display";
import { isPublicResearchListing } from "@/lib/catalog-filter";
import { DEFAULT_PAYMENT_PAYER, type PaymentPayer } from "@/lib/payment-payer";
import {
  loadStoredUnlocks,
  storeUnlock,
} from "@/lib/citation-unlock-session";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import "@/lib/ethereum-provider";

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
  author_backing?: ResearchBackingStats | null;
  report_backing?: ResearchBackingStats | null;
  already_unlocked?: boolean;
  unlocked_body?: string;
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
  if (count === 0) return "0 readers";
  if (count === 1) return "1 reader";
  return `${count} readers`;
}

type Props = {
  refreshKey?: number;
};

export function MarketplaceCitations({ refreshKey = 0 }: Props) {
  const [listings, setListings] = useState<CitationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attestOpen, setAttestOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");
  const [expandStates, setExpandStates] = useState<Record<string, ExpandState>>({});
  const [trustStates, setTrustStates] = useState<Record<string, TrustCellState>>({});
  const [metamaskAvailable, setMetamaskAvailable] = useState(false);
  const [expandedListingIds, setExpandedListingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMetamaskAvailable(typeof window !== "undefined" && Boolean(window.ethereum));
  }, []);

  const openAttest = useCallback((target: string) => {
    setCurrentTarget(target);
    setAttestOpen(true);
  }, []);

  const toggleListingExpanded = useCallback((id: string) => {
    setExpandedListingIds((prev) => ({ ...prev, [id]: !prev[id] }));
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
    async (item: CitationListing, payer: PaymentPayer) => {
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
            toast.success("Reputation updated", {
              description: `Score ${result.trust.score}${result.trust.tier ? ` · ${result.trust.tier}` : ""}`,
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
            toast.message(result.trust ? "Using cached score" : "No score available yet");
            break;
          case "cancelled":
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: { status: "idle", trust: prior.trust },
            }));
            toast.message("Payment cancelled");
            break;
          case "unconfigured":
          case "failed":
            setTrustStates((prev) => ({
              ...prev,
              [item.id]: { status: "idle", trust: prior.trust },
            }));
            toast.error(
              result.status === "unconfigured"
                ? "Reputation scoring not configured"
                : "Lookup failed",
              result.status === "failed" ? { description: result.reason } : undefined,
            );
            break;
        }
      } catch (err) {
        setTrustStates((prev) => ({
          ...prev,
          [item.id]: { status: "idle", trust: prior.trust },
        }));
        toast.error("Could not verify reputation", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [getTrustState],
  );

  const runUnlock = useCallback(
    async (item: CitationListing, payer: PaymentPayer) => {
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
            storeUnlock(item.id, result.body);
            bumpPaidCount(item.id);
            toast.success("Research unlocked");
            break;
          case "cancelled":
            setExpand(item.id, { status: "locked" });
            toast.message("Payment cancelled");
            break;
          case "failed":
            setExpand(item.id, { status: "locked" });
            toast.error("Could not unlock", { description: result.reason });
            break;
        }
      } catch (err) {
        setExpand(item.id, { status: "locked" });
        toast.error("Unlock failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [bumpPaidCount, expandStates, setExpand],
  );

  const loadListings = useCallback(async (signal?: AbortSignal, options?: { refresh?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const query = options?.refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/marketplace/citations${query}`, { signal });
      if (!res.ok) throw new Error(`Failed to load research (${res.status})`);
      const data = (await res.json()) as { listings?: CitationListing[] };
      const rows = (data.listings ?? []).filter(isPublicResearchListing);
      setListings(rows);

      const storedUnlocks = loadStoredUnlocks();
      setExpandStates((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (row.already_unlocked && row.unlocked_body) {
            next[row.id] = { status: "unlocked", body: row.unlocked_body };
            storeUnlock(row.id, row.unlocked_body);
            continue;
          }
          const cached = storedUnlocks[row.id];
          if (cached?.body && next[row.id]?.status !== "unlocked") {
            next[row.id] = { status: "unlocked", body: cached.body };
          }
        }
        return next;
      });

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
      setError(err instanceof Error ? err.message : "Failed to load research");
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
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
            <FileText size={18} className="text-[#f5c842]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold tracking-wide">Research catalog</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
              {loading
                ? "Loading reports…"
                : `${listings.length} reports — browse, unlock, and cite. Reputation and backing are optional on each card.`}
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground font-mono">
            <Loader2 size={16} className="animate-spin text-[#f5c842]" />
            Loading research…
          </div>
        )}

        {error && (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && listings.length === 0 && (
          <p className="py-8 text-center font-mono text-sm text-muted-foreground">
            No research listings yet.
          </p>
        )}

        <div className="grid gap-3">
          {listings.map((item) => {
            const expand = expandStates[item.id] ?? { status: "locked" };
            const isUnlocked = expand.status === "unlocked";
            const isUnlockLoading = expand.status === "loading";
            const trustCell = getTrustState(item);
            const displayTrust = selectTrustForPost(item.id, trustCell.trust);
            const trustLoading = trustCell.status === "loading";
            const paidTrustDone =
              trustCell.status === "done" && displayTrust?.source === "paid";
            const defaultPayer = DEFAULT_PAYMENT_PAYER;
            const canChoosePayer = metamaskAvailable;
            const showVerifyReputation =
              item.trust_paid_lookup && !paidTrustDone && displayTrust?.source !== "paid";
            const listingExpanded = expandedListingIds[item.id] ?? false;

            const unlockButton = (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUnlockLoading || isUnlocked}
                onClick={() => void runUnlock(item, defaultPayer)}
                className="gap-1.5 border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10 hover:text-[#f5c842]"
              >
                {isUnlockLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Unlocking…
                  </>
                ) : isUnlocked ? (
                  <>
                    <LockOpen size={14} />
                    Unlocked
                  </>
                ) : (
                  <>Unlock · ${item.price_usdc}</>
                )}
              </Button>
            );

            return (
              <article
                key={item.id}
                className="rounded border border-[#1f1f1f] bg-[#111]/80 transition-colors hover:border-[#f5c842]/25"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleListingExpanded(item.id)}
                    aria-expanded={listingExpanded}
                    className="min-w-0 flex-1 space-y-2 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
                        ${item.price_usdc} {item.token}
                      </Badge>
                      <TrustSignalBadge trust={displayTrust} />
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#666]">
                        <Users size={10} />
                        {paidCountLabel(item.paid_count)}
                      </span>
                      {isUnlocked && (
                        <Badge className="bg-[#f5c842]/10 text-[#f5c842] border border-[#f5c842]/30 text-[10px]">
                          Unlocked
                        </Badge>
                      )}
                      <ChevronDown
                        size={14}
                        className={cn(
                          "ml-auto text-[#666] transition-transform sm:ml-0",
                          listingExpanded && "rotate-180",
                        )}
                      />
                    </div>
                    <h3 className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
                      {item.title}
                    </h3>
                    <p className="font-mono text-xs text-[#666]">{item.author}</p>
                  </button>

                  <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:min-w-[148px]">
                    {canChoosePayer ? (
                      <div className="flex items-center gap-1 w-full sm:w-auto">
                        {unlockButton}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUnlockLoading || isUnlocked}
                              aria-label="Choose payment wallet"
                              className="px-2 border-[#f5c842]/35 text-[#f5c842]"
                            >
                              ···
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void runUnlock(item, "agent")}>
                              Agent wallet (default)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void runUnlock(item, "metamask")}>
                              MetaMask / connected wallet
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      unlockButton
                    )}

                    <div className="flex flex-wrap gap-1.5 justify-end w-full">
                      {showVerifyReputation && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={trustLoading}
                            onClick={() => void runTrustLookup(item, defaultPayer)}
                            className="h-7 px-2 text-[10px] font-mono text-[#888] hover:text-[#f5c842]"
                          >
                            {trustLoading ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Shield size={12} className="mr-1" />
                            )}
                            Verify reputation ({PAID_TRUST_FEE})
                          </Button>
                          {canChoosePayer && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={trustLoading}
                                  aria-label="Choose reputation payer"
                                  className="h-7 px-1.5 text-[10px] text-[#666]"
                                >
                                  ···
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => void runTrustLookup(item, "agent")}
                                >
                                  Agent wallet (default)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void runTrustLookup(item, "metamask")}
                                >
                                  MetaMask / connected wallet
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )}
                      <AttestTrigger
                        target={`citation:${item.id}`}
                        onAttest={openAttest}
                        label="Back this research"
                        variant="ghost"
                        className="h-7 px-2 text-[10px] font-mono text-[#888] hover:text-[#f5c842] border-transparent"
                      />
                      <AttestTrigger
                        target={`author:${item.author}`}
                        onAttest={openAttest}
                        label="Back this researcher"
                        variant="ghost"
                        className="h-7 px-2 text-[10px] font-mono text-[#888] hover:text-[#f5c842] border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {listingExpanded && (
                  <div className="space-y-3 border-t border-[#1f1f1f] px-4 pb-4 pt-3">
                    <BackingHint
                      authorBacking={item.author_backing}
                      reportBacking={item.report_backing}
                    />
                    <p className="font-mono text-xs leading-relaxed text-[#888]">
                      {item.subheading}
                    </p>

                    {isUnlocked && (
                      <div className="rounded border border-[#f5c842]/20 bg-[#0a0a0a] px-3 py-3">
                        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#d4d4d4]">
                          {expand.body}
                        </p>
                      </div>
                    )}

                    {item.tags.length > 0 && (
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
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Panel>

      <AttestModal
        isOpen={attestOpen}
        onClose={() => setAttestOpen(false)}
        target={currentTarget}
        copyMode="research"
        onSuccess={() => void loadListings(undefined, { refresh: true })}
      />
    </>
  );
}