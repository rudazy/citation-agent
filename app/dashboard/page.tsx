/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttestModal, AttestationRegistry } from "@/components/attest";
import { AttestTrigger } from "@/components/attest/attest-trigger";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Activity,
  ArrowRight,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import {
  MobileDataCard,
  MobileDataCardList,
} from "@/components/dashboard/mobile-data-cards";
import { Panel } from "@/components/layout/panel";
import { PaymentTrace } from "@/components/marketplace/payment-trace";
import { shortenHash } from "@/lib/utils";
import { DEMO_SETTLEMENT_ID } from "@/lib/marketplace";
import { SupabaseSetupBanner } from "@/components/dashboard/supabase-setup-banner";
import { PlatformSummaryCards } from "@/components/dashboard/platform-summary-cards";
import { SellerGatewayControls } from "@/components/dashboard/seller-gateway-controls";
import { formatPaymentDate } from "@/lib/format-datetime";
import { useAttestationFees } from "@/hooks/use-attestation-fees";
import { usePaymentEvents } from "@/hooks/use-transactions";
import { useCreatorEarnings } from "@/hooks/use-creator-earnings";
import { useAgentReputation } from "@/hooks/use-agent-reputation";
import { usePlatformTotals } from "@/hooks/use-platform-totals";
import {
  isOperator,
  operatorHeaders,
  signOperatorAuth,
  type OperatorAuth,
} from "@/lib/operator-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import "@/lib/ethereum-provider";

const OPERATOR_AUTH_TTL_MS = 14 * 60 * 1000;

type SortDirection = "default" | "asc" | "desc";
type SortField = "amount" | "date";

const EXPLORER_BASE = "https://testnet.arcscan.app";

function nextSortDirection(current: SortDirection): SortDirection {
  if (current === "default") return "asc";
  if (current === "asc") return "desc";
  return "default";
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc") return <ArrowUp size={14} />;
  if (direction === "desc") return <ArrowDown size={14} />;
  return <ArrowUpDown size={14} className="text-muted-foreground/50" />;
}

function parseAmount(amount: string): number {
  return parseFloat(amount.replace(/,/g, ""));
}

function CopyableCell({
  value,
  label,
  href,
}: {
  value: string;
  label?: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <span className="inline-flex items-center gap-1.5">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline text-primary"
        >
          {label ?? value}
        </a>
      ) : (
        <span>{label ?? value}</span>
      )}
      <Tooltip open={copied || undefined}>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
          >
            <Copy size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
      </Tooltip>
    </span>
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

function OperatorLedgerNotice() {
  return (
    <Panel className="p-6 text-center space-y-2">
      <p className="font-semibold tracking-wide">Operator access required</p>
      <p className="text-sm text-muted-foreground font-mono leading-relaxed max-w-md mx-auto">
        The per-row payment ledger is visible only to the platform operator. Summary
        totals above update live for everyone.
      </p>
    </Panel>
  );
}

export default function Dashboard() {
  const searchParams = useSearchParams();

  // ── Operator (platform fee recipient) detection + signed auth ──
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("payments");
  const operator = isOperator(connectedAccount);

  useEffect(() => {
    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum) return;
    let active = true;
    (async () => {
      try {
        const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
        if (active) setConnectedAccount(accounts?.[0] ?? null);
      } catch {
        if (active) setConnectedAccount(null);
      }
    })();
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      setConnectedAccount(accounts?.[0] ?? null);
    };
    ethereum.on?.("accountsChanged", onAccountsChanged);
    return () => {
      active = false;
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  const operatorAuthRef = useRef<OperatorAuth | null>(null);
  const operatorAuthInFlight = useRef<Promise<OperatorAuth> | null>(null);

  // Drop a cached signature if the connected wallet changes.
  useEffect(() => {
    operatorAuthRef.current = null;
  }, [connectedAccount]);

  const ensureOperatorAuth = useCallback(async (): Promise<OperatorAuth> => {
    const current = operatorAuthRef.current;
    if (current && Date.now() - Number(current.timestamp) < OPERATOR_AUTH_TTL_MS) {
      return current;
    }
    if (operatorAuthInFlight.current) return operatorAuthInFlight.current;

    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum) throw new Error("Wallet not found");
    if (!connectedAccount) throw new Error("Connect your operator wallet");

    const promise = (async () => {
      const auth = await signOperatorAuth(ethereum, connectedAccount as `0x${string}`);
      operatorAuthRef.current = auth;
      return auth;
    })();
    operatorAuthInFlight.current = promise;
    try {
      return await promise;
    } finally {
      operatorAuthInFlight.current = null;
    }
  }, [connectedAccount]);

  const getOperatorAuthHeaders = useCallback(
    async () => operatorHeaders(await ensureOperatorAuth()),
    [ensureOperatorAuth],
  );

  const {
    events,
    loading: loadingPayments,
    error: paymentsError,
    refetch: refetchPayments,
  } = usePaymentEvents({ enabled: operator, getAuthHeaders: getOperatorAuthHeaders });
  const {
    fees: attestationFees,
    loading: loadingAttestationFees,
    totalFees: attestationFeesTotal,
    refetch: refetchAttestationFees,
  } = useAttestationFees({
    enabled: operator && activeTab === "attestation-fees",
    getAuthHeaders: getOperatorAuthHeaders,
  });
  const { earnings, loading: loadingEarnings } = useCreatorEarnings({
    enabled: operator,
    getAuthHeaders: getOperatorAuthHeaders,
  });
  const { agents, loading: loadingReputation } = useAgentReputation({
    enabled: operator,
    getAuthHeaders: getOperatorAuthHeaders,
  });
  const {
    totals: platformTotals,
    loading: loadingPlatformTotals,
    error: platformTotalsError,
    refetch: refetchPlatformTotals,
  } = usePlatformTotals();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "trace") setActiveTab("trace");
    else if (tab === "attestations") setActiveTab("attestations");
  }, [searchParams]);

  // Never leave a non-operator on the operator-only fees tab.
  useEffect(() => {
    if (!operator && activeTab === "attestation-fees") setActiveTab("payments");
  }, [operator, activeTab]);

  useEffect(() => {
    if (activeTab === "withdrawals") setActiveTab("payments");
  }, [activeTab]);
  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("default");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [attestOpen, setAttestOpen] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("");

  const openAttest = useCallback((target: string) => {
    setCurrentTarget(target);
    setAttestOpen(true);
  }, []);

  function handleSort(field: SortField) {
    if (sortField === field) {
      const next = nextSortDirection(sortDirection);
      setSortDirection(next);
      if (next === "default") setSortField(null);
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  }

  // ── Payments filtering & sorting ──
  const filteredPayments = useMemo(() => {
    let result = events;

    if (filter) {
      const query = filter.toLowerCase();
      result = result.filter(
        (ev) =>
          (ev.gateway_tx ?? "").toLowerCase().includes(query) ||
          ev.payer.toLowerCase().includes(query) ||
          ev.endpoint.toLowerCase().includes(query),
      );
    }

    if (sortField && sortDirection !== "default") {
      result = [...result].sort((a, b) => {
        let cmp: number;
        if (sortField === "amount") {
          cmp = parseAmount(a.amount_usdc) - parseAmount(b.amount_usdc);
        } else {
          cmp = a.created_at.localeCompare(b.created_at);
        }
        return sortDirection === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [events, filter, sortField, sortDirection]);

  const activeData = filteredPayments;
  const loading = loadingPayments;
  const totalPages = Math.max(1, Math.ceil(activeData.length / pageSize));

  // Clamp page if data shrinks (e.g. realtime delete)
  const clampedPage = Math.min(page, totalPages);

  const paginatedPayments = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, clampedPage, pageSize]);

  const statAttestationFees = attestationFees.length;

  const operatorLedgerCards = operator
    ? [{ label: "Attest fees", value: statAttestationFees.toLocaleString() }]
    : [];

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-wide text-gradient-amber">
            Settlement dashboard
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-mono max-w-xl leading-relaxed">
            Settlement machinery: payments, royalties, agent wallets, attestations, gateway
            balances, and full trace. The marketplace sells research — the dashboard reveals
            how it settles.
          </p>
        </div>
        <AttestTrigger
          target="@trustgated"
          onAttest={openAttest}
          label="New attestation"
          variant="default"
          size="default"
          className="w-full sm:w-auto shrink-0"
        />
      </div>

      <SupabaseSetupBanner
        clientError={platformTotalsError ?? (operator ? paymentsError : null)}
        onRefresh={() => {
          void refetchPlatformTotals();
          if (operator) void refetchPayments();
        }}
        refreshing={loadingPlatformTotals || (operator && loadingPayments)}
      />

      <PlatformSummaryCards
        totals={platformTotals}
        loading={loadingPlatformTotals}
        extraCards={operatorLedgerCards}
      />

      {activeTab !== "trace" && (
        <button
          type="button"
          onClick={() => setActiveTab("trace")}
          className="w-full panel-surface panel-glow border-[#ff8a3d]/25 bg-gradient-to-br from-[#ff8a3d]/10 via-[#111111]/80 to-[#f5c842]/5 p-4 text-left transition-all hover:border-[#ff8a3d]/45 active:scale-[0.99]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-[#ff8a3d]/25 bg-[#ff8a3d]/10">
                <Activity size={18} className="text-[#ff8a3d]" />
              </div>
              <div>
                <p className="font-semibold tracking-wide">Payment Trace</p>
                <p className="text-sm text-muted-foreground font-mono">
                  Follow EIP-712 signatures through Circle Gateway to on-chain submitBatch
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#ff8a3d]/40 px-3 py-1.5 text-sm text-[#b35a18] shrink-0">
              Open trace
              <ArrowRight size={14} />
            </span>
          </div>
        </button>
      )}

      {activeTab !== "trace" &&
        activeTab !== "creators" &&
        activeTab !== "reputation" &&
        (activeTab !== "payments" || operator) && (
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder="Filter by tx hash, payer, or endpoint..."
            className="w-full sm:max-w-xs"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          />
          <div className="flex items-center justify-between gap-2 sm:ml-auto sm:justify-end">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              Rows per page
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            >
              <SelectTrigger size="sm" className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setFilter("");
          setPage(1);
          setSortField(null);
          setSortDirection("default");
        }}
      >
        <div className="-mx-3 sm:mx-0 overflow-x-auto scrollbar-none px-3 sm:px-0">
          <TabsList className="inline-flex h-auto w-max min-w-full gap-1 border border-border/60 bg-[#111111]/90 p-1 sm:flex sm:w-full sm:flex-wrap">
            <TabsTrigger
              value="trace"
              className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#ff8a3d]/12 data-[state=active]:text-[#ff8a3d] data-[state=active]:ring-1 data-[state=active]:ring-[#ff8a3d]/35"
            >
              <Activity size={14} />
              Trace
            </TabsTrigger>
            <TabsTrigger value="payments" className="shrink-0 px-3 text-xs sm:text-sm">Payments</TabsTrigger>
            <TabsTrigger value="creators" className="shrink-0 px-3 text-xs sm:text-sm">Creators</TabsTrigger>
            <TabsTrigger value="reputation" className="shrink-0 px-3 text-xs sm:text-sm">Agents</TabsTrigger>
            {operator && (
              <TabsTrigger
                value="attestation-fees"
                className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm data-[state=active]:bg-[#f5c842]/12 data-[state=active]:text-[#f5c842] data-[state=active]:ring-1 data-[state=active]:ring-[#f5c842]/35"
              >
                Attest fees
              </TabsTrigger>
            )}
            <TabsTrigger
              value="attestations"
              className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm data-[state=active]:bg-[#f5c842]/12 data-[state=active]:text-[#f5c842] data-[state=active]:ring-1 data-[state=active]:ring-[#f5c842]/35"
            >
              <Shield size={14} />
              Claims
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payments">
          {!operator ? (
            <OperatorLedgerNotice />
          ) : (
          <>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => void refetchPayments()}
              disabled={loadingPayments}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingPayments ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
          <MobileDataCardList
            loading={loadingPayments}
            loadingMessage="Loading payments..."
            empty={!loadingPayments && paginatedPayments.length === 0 ? "No payments found." : undefined}
          >
            {paginatedPayments.map((ev) => (
              <MobileDataCard
                key={ev.id}
                fields={[
                  {
                    label: "Transaction",
                    value: ev.gateway_tx ? (
                      <CopyableCell
                        value={ev.gateway_tx}
                        label={shortenHash(ev.gateway_tx, 6)}
                        href={
                          ev.gateway_tx.startsWith("0x")
                            ? `${EXPLORER_BASE}/tx/${ev.gateway_tx}`
                            : undefined
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Payer",
                    value: (
                      <CopyableCell
                        value={ev.payer}
                        label={shortenHash(ev.payer)}
                        href={`${EXPLORER_BASE}/address/${ev.payer}`}
                      />
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Endpoint",
                    value: (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                        {ev.endpoint}
                      </code>
                    ),
                  },
                  {
                    label: "Amount (USDC)",
                    value: `$${ev.amount_usdc}`,
                    className: "font-mono text-[#ff8a3d] font-semibold",
                    highlight: true,
                  },
                  {
                    label: "Date",
                    value: formatPaymentDate(ev.created_at),
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
            ))}
          </MobileDataCardList>
          <div className="hidden lg:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                      onClick={() => handleSort("amount")}
                    >
                      Amount (USDC)
                      <SortIcon
                        direction={sortField === "amount" ? sortDirection : "default"}
                      />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      Date
                      <SortIcon direction={sortField === "date" ? sortDirection : "default"} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPayments ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Loading payments...
                    </TableCell>
                  </TableRow>
                ) : paginatedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayments.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs">
                        {ev.gateway_tx ? (
                          <CopyableCell
                            value={ev.gateway_tx}
                            label={shortenHash(ev.gateway_tx, 6)}
                            href={
                              ev.gateway_tx.startsWith("0x")
                                ? `${EXPLORER_BASE}/tx/${ev.gateway_tx}`
                                : undefined
                            }
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <CopyableCell
                          value={ev.payer}
                          label={shortenHash(ev.payer)}
                          href={`${EXPLORER_BASE}/address/${ev.payer}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {ev.endpoint}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${ev.amount_usdc}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatPaymentDate(ev.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </>
          )}
        </TabsContent>

        <TabsContent value="creators">
          {!operator ? (
            <OperatorLedgerNotice />
          ) : (
          <>
          <MobileDataCardList
            loading={loadingEarnings}
            loadingMessage="Loading creator earnings..."
            empty={
              !loadingEarnings && earnings.length === 0
                ? "No creator royalties yet. Run the research agent to pay citations."
                : undefined
            }
          >
            {earnings.map((row) => (
              <div key={row.id} className="space-y-2">
              <MobileDataCard
                fields={[
                  {
                    label: "Citation",
                    value: (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                        {row.citation_id}
                      </code>
                    ),
                  },
                  {
                    label: "Creator",
                    value: (
                      <>
                        <div>{row.creator_name}</div>
                        <CopyableCell
                          value={row.creator_wallet}
                          label={shortenHash(row.creator_wallet)}
                          href={`${EXPLORER_BASE}/address/${row.creator_wallet}`}
                        />
                      </>
                    ),
                    className: "text-xs",
                  },
                  {
                    label: "Payer",
                    value: (
                      <CopyableCell
                        value={row.payer}
                        label={shortenHash(row.payer)}
                        href={`${EXPLORER_BASE}/address/${row.payer}`}
                      />
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Gross (USDC)",
                    value: `$${row.gross_usdc}`,
                    className: "font-mono",
                  },
                  {
                    label: "Royalty (USDC)",
                    value: `$${row.royalty_usdc}`,
                    className: "font-mono text-[#f5c842] font-semibold",
                    highlight: true,
                  },
                  {
                    label: "Date",
                    value: formatPaymentDate(row.created_at),
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
              <div className="flex flex-wrap gap-2 px-1">
                <AttestTrigger
                  target={`citation:${row.citation_id}`}
                  onAttest={openAttest}
                  label="Attest citation"
                />
                <AttestTrigger
                  target={row.creator_wallet}
                  onAttest={openAttest}
                  label="Attest creator"
                  variant="ghost"
                />
              </div>
              </div>
            ))}
          </MobileDataCardList>
          <div className="hidden lg:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Citation</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead className="text-right">Gross (USDC)</TableHead>
                  <TableHead className="text-right">Royalty (USDC)</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Attest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingEarnings ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Loading creator earnings...
                    </TableCell>
                  </TableRow>
                ) : earnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No creator royalties yet. Run the research agent to pay citations.
                    </TableCell>
                  </TableRow>
                ) : (
                  earnings.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {row.citation_id}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{row.creator_name}</div>
                        <CopyableCell
                          value={row.creator_wallet}
                          label={shortenHash(row.creator_wallet)}
                          href={`${EXPLORER_BASE}/address/${row.creator_wallet}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <CopyableCell
                          value={row.payer}
                          label={shortenHash(row.payer)}
                          href={`${EXPLORER_BASE}/address/${row.payer}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.gross_usdc}</TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        ${row.royalty_usdc}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatPaymentDate(row.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <AttestTrigger
                            target={`citation:${row.citation_id}`}
                            onAttest={openAttest}
                            label="Citation"
                          />
                          <AttestTrigger
                            target={row.creator_wallet}
                            onAttest={openAttest}
                            label="Creator"
                            variant="ghost"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </>
          )}
        </TabsContent>

        <TabsContent value="reputation">
          {!operator ? (
            <OperatorLedgerNotice />
          ) : (
          <>
          <MobileDataCardList
            loading={loadingReputation}
            loadingMessage="Loading agent reputation..."
            empty={
              !loadingReputation && agents.length === 0
                ? "No agent reputation data yet."
                : undefined
            }
          >
            {agents.map((agent) => (
              <div key={agent.payer} className="space-y-2">
              <MobileDataCard
                fields={[
                  {
                    label: "Agent Wallet",
                    value: (
                      <CopyableCell
                        value={agent.payer}
                        label={shortenHash(agent.payer)}
                        href={`${EXPLORER_BASE}/address/${agent.payer}`}
                      />
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Citations Paid",
                    value: agent.citation_count,
                    className: "font-mono",
                  },
                  {
                    label: "Total Spent (USDC)",
                    value: `$${Number(agent.total_spent_usdc).toFixed(6)}`,
                    className: "font-mono",
                  },
                  {
                    label: "Last Payment",
                    value: agent.last_payment_at ? formatPaymentDate(agent.last_payment_at) : "—",
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
              <div className="px-1">
                <AttestTrigger
                  target={`agent:${agent.payer}`}
                  onAttest={openAttest}
                  label="Attest agent"
                />
              </div>
              </div>
            ))}
          </MobileDataCardList>
          <div className="hidden lg:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Wallet</TableHead>
                  <TableHead className="text-right">Citations Paid</TableHead>
                  <TableHead className="text-right">Total Spent (USDC)</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead className="text-right">Attest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReputation ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Loading agent reputation...
                    </TableCell>
                  </TableRow>
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No agent reputation data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.payer}>
                      <TableCell className="font-mono text-xs">
                        <CopyableCell
                          value={agent.payer}
                          label={shortenHash(agent.payer)}
                          href={`${EXPLORER_BASE}/address/${agent.payer}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {agent.citation_count}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(agent.total_spent_usdc).toFixed(6)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {agent.last_payment_at ? formatPaymentDate(agent.last_payment_at) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AttestTrigger
                          target={`agent:${agent.payer}`}
                          onAttest={openAttest}
                          label="Attest"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </>
          )}
        </TabsContent>

        {operator && (
        <TabsContent value="attestation-fees">
          <Panel className="mb-4 border-[#f5c842]/20 bg-[#f5c842]/5 px-4 py-3 space-y-4">
            <p className="text-sm font-mono text-muted-foreground leading-relaxed">
              Flat <span className="text-[#f5c842] font-semibold">0.1 USDC</span> platform fee per
              attestation only — not marketplace or citation payments. Fees settle to the operator
              seller wallet on Arc (withdraw below). Visitors use the header for their own agent
              Gateway balance.
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums text-[#f5c842]">
              ${attestationFeesTotal.toFixed(1)} USDC earned ({statAttestationFees} attestation
              {statAttestationFees !== 1 ? "s" : ""})
            </p>
            <SellerGatewayControls getAuthHeaders={getOperatorAuthHeaders} />
          </Panel>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => void refetchAttestationFees()}
              disabled={loadingAttestationFees}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingAttestationFees ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
          <MobileDataCardList
            loading={loadingAttestationFees}
            loadingMessage="Loading attestation fees..."
            empty={
              !loadingAttestationFees && attestationFees.length === 0
                ? "No attestation platform fees yet."
                : undefined
            }
          >
            {attestationFees.map((row) => (
              <MobileDataCard
                key={row.id}
                fields={[
                  {
                    label: "Attestation tx",
                    value: row.attest_tx_hash ? (
                      <CopyableCell
                        value={row.attest_tx_hash}
                        label={shortenHash(row.attest_tx_hash, 6)}
                        href={`${EXPLORER_BASE}/tx/${row.attest_tx_hash}`}
                      />
                    ) : (
                      "—"
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Target",
                    value: (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                        {row.target}
                      </code>
                    ),
                  },
                  {
                    label: "Staker",
                    value: (
                      <CopyableCell
                        value={row.staker}
                        label={shortenHash(row.staker)}
                        href={`${EXPLORER_BASE}/address/${row.staker}`}
                      />
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Stake (USDC)",
                    value: `$${row.stake_usdc}`,
                    className: "font-mono",
                  },
                  {
                    label: "Platform fee (USDC)",
                    value: `$${row.platform_fee_usdc}`,
                    className: "font-mono text-[#f5c842] font-semibold",
                    highlight: true,
                  },
                  {
                    label: "Date",
                    value: formatPaymentDate(row.created_at),
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
            ))}
          </MobileDataCardList>
          <div className="hidden lg:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attestation tx</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Staker</TableHead>
                  <TableHead className="text-right">Stake (USDC)</TableHead>
                  <TableHead className="text-right">Platform fee</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAttestationFees ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Loading attestation fees...
                    </TableCell>
                  </TableRow>
                ) : attestationFees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No attestation platform fees yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  attestationFees.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        <CopyableCell
                          value={row.attest_tx_hash}
                          label={shortenHash(row.attest_tx_hash, 6)}
                          href={`${EXPLORER_BASE}/tx/${row.attest_tx_hash}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {row.target}
                        </code>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <CopyableCell
                          value={row.staker}
                          label={shortenHash(row.staker)}
                          href={`${EXPLORER_BASE}/address/${row.staker}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.stake_usdc}</TableCell>
                      <TableCell className="text-right font-mono text-[#f5c842]">
                        ${row.platform_fee_usdc}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatPaymentDate(row.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        )}

        <TabsContent value="attestations">
          <AttestationRegistry />
        </TabsContent>

        <TabsContent value="trace">
          <Panel glow className="border-[#ff8a3d]/20 bg-gradient-to-b from-[#ff8a3d]/8 to-transparent p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-[#ff8a3d]" />
              <h2 className="text-lg font-semibold tracking-wide">Settlement trace decoder</h2>
            </div>
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">
              Decode Circle Gateway settlements from EIP-712 signature through on-chain{" "}
              <code>submitBatch</code>. Paste a settlement UUID from the Payments tab or run a
              live purchase on the{" "}
              <a href="/marketplace" className="text-[#ff8a3d] hover:underline">
                Marketplace
              </a>
              .
            </p>
            <PaymentTrace initialSettlementId={DEMO_SETTLEMENT_ID} />
          </Panel>
        </TabsContent>
      </Tabs>

      {/* Shared pagination controls */}
      {!loading && activeTab === "payments" && operator && activeData.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-x border-b rounded-b-lg px-3 sm:px-4 py-3 text-xs sm:text-sm">
          <span className="text-muted-foreground">
            {activeData.length} transaction{activeData.length !== 1 ? "s" : ""} total
          </span>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-muted-foreground">
              Page {clampedPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={clampedPage <= 1}
              className="inline-flex items-center justify-center rounded-md border h-8 w-8 disabled:opacity-30 hover:bg-muted transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage >= totalPages}
              className="inline-flex items-center justify-center rounded-md border h-8 w-8 disabled:opacity-30 hover:bg-muted transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <AttestModal
        isOpen={attestOpen}
        onClose={() => setAttestOpen(false)}
        target={currentTarget}
      />
    </div>
  );
}
