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

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import {
  MobileDataCard,
  MobileDataCardList,
  StatusBadge,
} from "@/components/dashboard/mobile-data-cards";
import { PaymentTrace } from "@/components/marketplace/payment-trace";
import { shortenHash } from "@/lib/utils";
import { DEMO_SETTLEMENT_ID } from "@/lib/marketplace";
import { usePaymentEvents } from "@/hooks/use-transactions";
import { useWithdrawals } from "@/hooks/use-withdrawals";
import { useCreatorEarnings } from "@/hooks/use-creator-earnings";
import { useAgentReputation } from "@/hooks/use-agent-reputation";

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export default function Dashboard() {
  const searchParams = useSearchParams();
  const { events, loading: loadingPayments } = usePaymentEvents();
  const { withdrawals, loading: loadingWithdrawals } = useWithdrawals();
  const { earnings, loading: loadingEarnings } = useCreatorEarnings();
  const { agents, loading: loadingReputation } = useAgentReputation();
  const [activeTab, setActiveTab] = useState("payments");

  useEffect(() => {
    if (searchParams.get("tab") === "trace") {
      setActiveTab("trace");
    }
  }, [searchParams]);
  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("default");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

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

  // ── Withdrawals filtering & sorting ──
  const filteredWithdrawals = useMemo(() => {
    let result = withdrawals;

    if (filter) {
      const query = filter.toLowerCase();
      result = result.filter(
        (w) =>
          (w.tx_hash ?? "").toLowerCase().includes(query) ||
          w.destination_address.toLowerCase().includes(query) ||
          w.destination_chain.toLowerCase().includes(query) ||
          w.status.toLowerCase().includes(query),
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
  }, [withdrawals, filter, sortField, sortDirection]);

  const activeData = activeTab === "payments" ? filteredPayments : filteredWithdrawals;
  const loading = activeTab === "payments" ? loadingPayments : loadingWithdrawals;
  const totalPages = Math.max(1, Math.ceil(activeData.length / pageSize));

  // Clamp page if data shrinks (e.g. realtime delete)
  const clampedPage = Math.min(page, totalPages);

  const paginatedPayments = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, clampedPage, pageSize]);

  const paginatedWithdrawals = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return filteredWithdrawals.slice(start, start + pageSize);
  }, [filteredWithdrawals, clampedPage, pageSize]);

  return (
    <div className="max-w-6xl mx-auto w-full min-w-0">
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 min-w-0">
          <AppLogo href={undefined} showSubtitle />
          <p className="text-muted-foreground text-xs sm:text-sm font-mono max-w-xl">
            Monitor nanopayments, creator royalties, agent reputation, and withdrawals.
            Settlement traces decode every x402 batch on Arc.
          </p>
        </div>
      </div>

      {activeTab !== "trace" && (
        <button
          type="button"
          onClick={() => setActiveTab("trace")}
          className="mb-4 w-full rounded-lg border border-[#ff8a3d]/30 bg-gradient-to-r from-[#ff8a3d]/8 via-transparent to-[#f5c842]/8 p-4 text-left transition-colors hover:border-[#ff8a3d]/50 hover:from-[#ff8a3d]/12"
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

      {activeTab !== "trace" && activeTab !== "creators" && activeTab !== "reputation" && (
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder={
              activeTab === "payments"
                ? "Filter by tx hash, payer, or endpoint..."
                : "Filter by tx hash, address, chain, or status..."
            }
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
        <TabsList className="grid w-full grid-cols-2 h-auto gap-1 p-1.5 sm:flex sm:flex-wrap">
          <TabsTrigger
            value="trace"
            className="col-span-2 gap-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#ff8a3d]/12 data-[state=active]:text-[#b35a18] data-[state=active]:ring-1 data-[state=active]:ring-[#ff8a3d]/35"
          >
            <Activity size={14} />
            Payment Trace
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
          <TabsTrigger value="creators" className="text-xs sm:text-sm">Creator Earnings</TabsTrigger>
          <TabsTrigger value="reputation" className="text-xs sm:text-sm">Agent Reputation</TabsTrigger>
          <TabsTrigger value="withdrawals" className="text-xs sm:text-sm">Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
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
                    className: "font-mono",
                  },
                  {
                    label: "Date",
                    value: formatDate(ev.created_at),
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
            ))}
          </MobileDataCardList>
          <div className="hidden md:block rounded-lg border overflow-hidden">
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
                        {formatDate(ev.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="creators">
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
              <MobileDataCard
                key={row.id}
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
                    className: "font-mono text-primary",
                  },
                  {
                    label: "Date",
                    value: formatDate(row.created_at),
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
            ))}
          </MobileDataCardList>
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Citation</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead className="text-right">Gross (USDC)</TableHead>
                  <TableHead className="text-right">Royalty (USDC)</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingEarnings ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Loading creator earnings...
                    </TableCell>
                  </TableRow>
                ) : earnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
                        {formatDate(row.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="reputation">
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
              <MobileDataCard
                key={agent.payer}
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
                    value: agent.last_payment_at ? formatDate(agent.last_payment_at) : "—",
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
            ))}
          </MobileDataCardList>
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Wallet</TableHead>
                  <TableHead className="text-right">Citations Paid</TableHead>
                  <TableHead className="text-right">Total Spent (USDC)</TableHead>
                  <TableHead>Last Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReputation ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Loading agent reputation...
                    </TableCell>
                  </TableRow>
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
                        {agent.last_payment_at ? formatDate(agent.last_payment_at) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals">
          <MobileDataCardList
            loading={loadingWithdrawals}
            loadingMessage="Loading withdrawals..."
            empty={
              !loadingWithdrawals && paginatedWithdrawals.length === 0
                ? "No withdrawals found."
                : undefined
            }
          >
            {paginatedWithdrawals.map((w) => (
              <MobileDataCard
                key={w.id}
                fields={[
                  {
                    label: "Transaction",
                    value: w.tx_hash ? (
                      <CopyableCell
                        value={w.tx_hash}
                        label={shortenHash(w.tx_hash, 6)}
                        href={
                          w.tx_hash.startsWith("0x")
                            ? `${EXPLORER_BASE}/tx/${w.tx_hash}`
                            : undefined
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Destination",
                    value: (
                      <CopyableCell
                        value={w.destination_address}
                        label={shortenHash(w.destination_address)}
                        href={`${EXPLORER_BASE}/address/${w.destination_address}`}
                      />
                    ),
                    className: "font-mono text-xs",
                  },
                  {
                    label: "Chain",
                    value: (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                        {w.destination_chain}
                      </code>
                    ),
                  },
                  {
                    label: "Status",
                    value: <StatusBadge status={w.status} />,
                  },
                  {
                    label: "Amount (USDC)",
                    value: `$${w.amount_usdc}`,
                    className: "font-mono",
                  },
                  {
                    label: "Date",
                    value: formatDate(w.created_at),
                    className: "text-muted-foreground text-xs",
                  },
                ]}
              />
            ))}
          </MobileDataCardList>
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Status</TableHead>
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
                {loadingWithdrawals ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Loading withdrawals...
                    </TableCell>
                  </TableRow>
                ) : paginatedWithdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No withdrawals found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedWithdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">
                        {w.tx_hash ? (
                          <CopyableCell
                            value={w.tx_hash}
                            label={shortenHash(w.tx_hash, 6)}
                            href={
                              w.tx_hash.startsWith("0x")
                                ? `${EXPLORER_BASE}/tx/${w.tx_hash}`
                                : undefined
                            }
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <CopyableCell
                          value={w.destination_address}
                          label={shortenHash(w.destination_address)}
                          href={`${EXPLORER_BASE}/address/${w.destination_address}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {w.destination_chain}
                        </code>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={w.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${w.amount_usdc}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(w.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="trace">
          <div className="rounded-lg border border-[#ff8a3d]/20 bg-gradient-to-b from-[#ff8a3d]/6 to-transparent p-4 sm:p-6 space-y-4">
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
          </div>
        </TabsContent>
      </Tabs>

      {/* Shared pagination controls */}
      {!loading && activeTab !== "trace" && activeTab !== "creators" && activeTab !== "reputation" && activeData.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-x border-b rounded-b-lg px-3 sm:px-4 py-3 text-xs sm:text-sm">
          <span className="text-muted-foreground">
            {activeData.length} {activeTab === "payments" ? "transaction" : "withdrawal"}{activeData.length !== 1 ? "s" : ""} total
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
    </div>
  );
}
