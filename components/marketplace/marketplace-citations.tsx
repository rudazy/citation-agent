"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, FileText, Loader2, LockOpen, Shield, Users } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AttestModal } from "@/components/attest";
import { AttestTrigger } from "@/components/attest/attest-trigger";
import { BackingHint } from "@/components/marketplace/backing-hint";
import { CitationBodyMarkdown } from "@/components/marketplace/citation-body-markdown";
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
import {
  gatewayDepositPromptMessage,
  isInsufficientGatewayBalance,
  suggestGatewayDepositAmount,
} from "@/lib/citation-unlock-errors";
import { depositToGatewayViaMetaMask } from "@/lib/gateway-metamask";
import { depositAgentGatewayViaApi } from "@/lib/gateway-pay";
import { formatPaymentDate } from "@/lib/format-datetime";
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
  published_at?: string;
};

type ExpandState =
  | { status: "locked" }
  | { status: "loading" }
  | { status: "unlocked"; body: string }
  | {
      status: "needs_deposit";
      payer: PaymentPayer;
      depositAmount: string;
      message: string;
    }
  | { status: "depositing"; payer: PaymentPayer; depositAmount: string };

type TrustCellState =
  | { status: "idle"; trust: PublicTrustSignal | null }
  | { status: "loading"; trust: PublicTrustSignal | null }
  | { status: "done"; trust: PublicTrustSignal | null };

const PAID_TRUST_FEE = "0.001";
const GATEWAY_DEPOSIT_USDC = "1";

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
  const [catalogExpanded, setCatalogExpanded] = useState(true);
  const [gatewayFunding, setGatewayFunding] = useState(false);

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

  const showDepositPrompt = useCallback(
    (item: CitationListing, payer: PaymentPayer) => {
      const depositAmount = suggestGatewayDepositAmount(
        item.price_usdc,
        GATEWAY_DEPOSIT_USDC,
      );
      setExpand(item.id, {
        status: "needs_deposit",
        payer,
        depositAmount,
        message: gatewayDepositPromptMessage(depositAmount, item.price_usdc),
      });
    },
    [setExpand],
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
            if (isInsufficientGatewayBalance(result.reason)) {
              showDepositPrompt(item, payer);
            } else {
              setExpand(item.id, { status: "locked" });
              toast.error("Could not unlock", { description: result.reason });
            }
            break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (isInsufficientGatewayBalance(message)) {
          showDepositPrompt(item, payer);
        } else {
          setExpand(item.id, { status: "locked" });
          toast.error("Unlock failed", { description: message });
        }
      }
    },
    [bumpPaidCount, expandStates, setExpand, showDepositPrompt],
  );

  const runDepositForUnlock = useCallback(
    async (item: CitationListing, payer: PaymentPayer, depositAmount: string) => {
      setExpand(item.id, { status: "depositing", payer, depositAmount });
      try {
        if (payer === "metamask") {
          const ethereum: EthereumProvider | undefined = window.ethereum;
          if (!ethereum) {
            setExpand(item.id, { status: "locked" });
            toast.error("MetaMask not detected");
            return;
          }
          await switchToArcTestnet(ethereum);
          const account = await getConnectedAccount(ethereum);
          await depositToGatewayViaMetaMask(ethereum, account, depositAmount);
        } else {
          await depositAgentGatewayViaApi(depositAmount);
        }
        await runUnlock(item, payer);
      } catch (err) {
        if ((err as { code?: number }).code === 4001) {
          setExpand(item.id, { status: "locked" });
          toast.message("Deposit cancelled");
          return;
        }
        setExpand(item.id, {
          status: "needs_deposit",
          payer,
          depositAmount,
          message: gatewayDepositPromptMessage(depositAmount, item.price_usdc),
        });
        toast.error("Deposit failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [runUnlock, setExpand],
  );

  const updateDepositAmount = useCallback(
    (listingId: string, depositAmount: string) => {
      setExpandStates((prev) => {
        const current = prev[listingId];
        if (current?.status !== "needs_deposit") return prev;
        return {
          ...prev,
          [listingId]: {
            ...current,
            depositAmount,
            message: gatewayDepositPromptMessage(
              depositAmount,
              listings.find((l) => l.id === listingId)?.price_usdc ?? "0",
            ),
          },
        };
      });
    },
    [listings],
  );

  const runGatewayDeposit = useCallback(async (payer: PaymentPayer, amount = GATEWAY_DEPOSIT_USDC) => {
    setGatewayFunding(true);
    try {
      if (payer === "metamask") {
        const ethereum: EthereumProvider | undefined = window.ethereum;
        if (!ethereum) {
          toast.error("MetaMask not detected");
          return;
        }
        await switchToArcTestnet(ethereum);
        const account = await getConnectedAccount(ethereum);
        await depositToGatewayViaMetaMask(ethereum, account, amount);
        toast.success("Payment balance funded", {
          description: `Deposited ${amount} USDC`,
        });
      } else {
        const result = await depositAgentGatewayViaApi(amount);
        toast.success("Payment balance funded", {
          description: `Available: $${result.gatewayAvailable} USDC`,
        });
      }
    } catch (err) {
      toast.error("Deposit failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setGatewayFunding(false);
    }
  }, []);

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
        <button
          type="button"
          onClick={() => setCatalogExpanded((v) => !v)}
          aria-expanded={catalogExpanded}
          className="flex w-full items-start gap-3 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
            <FileText size={18} className="text-[#f5c842]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold tracking-wide">Research catalog</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
              {catalogExpanded
                ? loading
                  ? "Loading reports…"
                  : `${listings.length} reports — unlock pays from Circle Gateway. Deposit below before unlocking.`
                : "Browse paywalled crypto research — expand to unlock, fund Gateway, and cite."}
            </p>
          </div>
          <ChevronDown
            size={18}
            className={cn(
              "mt-1 shrink-0 text-[#888] transition-transform",
              catalogExpanded && "rotate-180",
            )}
          />
        </button>

        {catalogExpanded && (
          <div className="space-y-4 border-t border-[#1f1f1f] pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded border border-[#1f1f1f] bg-[#111] px-3 py-2.5">
              <p className="font-mono text-[10px] text-[#666] leading-relaxed">
                Unlocks debit Circle Gateway, not your wallet directly. Deposit USDC first.
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={gatewayFunding}
                    className="shrink-0 gap-1.5 border-[#333] text-[#a3a3a3] hover:text-[#f5f5f5] font-mono text-[10px]"
                  >
                    {gatewayFunding ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Depositing…
                      </>
                    ) : (
                      <>
                        Deposit to Gateway
                        <ChevronDown size={12} />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px]">
                  <DropdownMenuItem
                    disabled={gatewayFunding}
                    onClick={() => void runGatewayDeposit("agent")}
                  >
                    {GATEWAY_DEPOSIT_USDC} USDC · agent wallet
                  </DropdownMenuItem>
                  {metamaskAvailable && (
                    <DropdownMenuItem
                      disabled={gatewayFunding}
                      onClick={() => void runGatewayDeposit("metamask")}
                    >
                      {GATEWAY_DEPOSIT_USDC} USDC · MetaMask
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled
                    className="text-[10px] font-mono text-[#666] focus:bg-transparent"
                  >
                    Then use Unlock on any report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            const isDepositing = expand.status === "depositing";
            const needsDeposit = expand.status === "needs_deposit";
            const trustCell = getTrustState(item);
            const displayTrust = selectTrustForPost(item.id, trustCell.trust);
            const trustLoading = trustCell.status === "loading";
            const paidTrustDone =
              trustCell.status === "done" && displayTrust?.source === "paid";
            const defaultPayer = DEFAULT_PAYMENT_PAYER;
            const depositAmount =
              needsDeposit || isDepositing ? expand.depositAmount : GATEWAY_DEPOSIT_USDC;
            const depositPayer =
              needsDeposit || isDepositing ? expand.payer : defaultPayer;
            const canChoosePayer = metamaskAvailable;
            const showVerifyReputation =
              item.trust_paid_lookup && !paidTrustDone && displayTrust?.source !== "paid";
            const listingExpanded = expandedListingIds[item.id] ?? false;

            const unlockButton = (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isUnlockLoading || isDepositing || isUnlocked}
                onClick={() => void runUnlock(item, defaultPayer)}
                className="gap-1.5 border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10 hover:text-[#f5c842]"
              >
                {isUnlockLoading || isDepositing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {isDepositing ? "Depositing…" : "Unlocking…"}
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
                    <div className="space-y-0.5">
                      <p className="font-mono text-xs text-[#666]">{item.author}</p>
                      {item.published_at && (
                        <p className="font-mono text-[10px] text-[#666]">
                          {formatPaymentDate(item.published_at)}
                        </p>
                      )}
                    </div>
                  </button>

                  <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:min-w-[148px]">
                    {!isUnlocked ? (
                      <div className="flex items-center gap-1 w-full sm:w-auto">
                        {unlockButton}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUnlockLoading || isDepositing || gatewayFunding}
                              aria-label="Unlock and Gateway options"
                              className="px-2 border-[#f5c842]/35 text-[#f5c842]"
                            >
                              ···
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[220px]">
                            <DropdownMenuItem onClick={() => void runUnlock(item, "agent")}>
                              Unlock · agent wallet (default)
                            </DropdownMenuItem>
                            {canChoosePayer && (
                              <DropdownMenuItem onClick={() => void runUnlock(item, "metamask")}>
                                Unlock · MetaMask / connected wallet
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled
                              className="text-[10px] font-mono text-[#666] focus:bg-transparent"
                            >
                              Fund Circle Gateway before unlock
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={gatewayFunding}
                              onClick={() => void runGatewayDeposit("agent")}
                            >
                              Deposit {GATEWAY_DEPOSIT_USDC} USDC · agent wallet
                            </DropdownMenuItem>
                            {canChoosePayer && (
                              <DropdownMenuItem
                                disabled={gatewayFunding}
                                onClick={() => void runGatewayDeposit("metamask")}
                              >
                                Deposit {GATEWAY_DEPOSIT_USDC} USDC · MetaMask
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      unlockButton
                    )}

                    {(needsDeposit || isDepositing) && (
                      <div className="w-full rounded border border-[#1f1f1f] bg-[#111] px-3 py-2.5 space-y-2">
                        {needsDeposit && (
                          <p className="font-mono text-[10px] text-[#a3a3a3] leading-relaxed">
                            {expand.message}
                          </p>
                        )}
                        {isDepositing && (
                          <p className="font-mono text-[10px] text-[#888]">
                            Moving USDC into your payment balance…
                          </p>
                        )}
                        {needsDeposit && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={depositAmount}
                              onChange={(e) =>
                                updateDepositAmount(item.id, e.target.value)
                              }
                              className="h-8 w-20 border-[#333] bg-[#141414] font-mono text-xs"
                              aria-label="Deposit amount in USDC"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={gatewayFunding}
                              onClick={() =>
                                void runDepositForUnlock(item, depositPayer, depositAmount)
                              }
                              className="h-8 border-[#f5c842]/35 font-mono text-[10px] text-[#f5c842] hover:bg-[#f5c842]/10"
                            >
                              Deposit and unlock
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpand(item.id, { status: "locked" })}
                              className="h-8 font-mono text-[10px] text-[#666]"
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
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
                      <div className="rounded border border-[#f5c842]/20 bg-[#0a0a0a] px-3 py-3 sm:px-4 sm:py-4">
                        <CitationBodyMarkdown content={expand.body} />
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
          </div>
        )}
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