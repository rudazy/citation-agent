"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  ARC_EXPLORER,
  DEMO_SETTLEMENT_ID,
  GATEWAY_API,
  GATEWAY_WALLET,
} from "@/lib/marketplace";

type Settlement = {
  id: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  createdAt: string;
  updatedAt: string;
};

type BatchInfo = {
  batchTx: string | null;
  status: string;
  explorerUrl: string | null;
};

type DecodedEntry = {
  address: string;
  usdc: string;
};

type DecodedBatch = {
  batchId: string;
  domain: number;
  token: string;
  innerContract: string;
  relayer: string;
  blockNumber: string;
  entries: DecodedEntry[];
  netTransfers: { from: string; to: string; usdc: string }[];
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "completed" || status === "confirmed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function ApiCall({
  method,
  url,
}: {
  method: "GET" | "POST";
  url: string;
}) {
  return (
    <div className="rounded border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
      <span
        className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground ${
          method === "POST" ? "bg-[#ff8a3d]" : "bg-[#333]"
        }`}
      >
        {method}
      </span>
      {method === "GET" ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-[#ff8a3d] hover:underline">
          {url}
        </a>
      ) : (
        url
      )}
    </div>
  );
}

function TraceStep({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative ml-2 border-l border-border pl-5 pb-5">
      <span className="absolute -left-3.5 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-muted-foreground">
        {step}
      </span>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function PaymentTrace({
  initialSettlementId = DEMO_SETTLEMENT_ID,
  focusBuyer,
}: {
  initialSettlementId?: string;
  focusBuyer?: string;
}) {
  const [settlementId, setSettlementId] = useState(initialSettlementId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [decoded, setDecoded] = useState<DecodedBatch | null>(null);

  const loadTrace = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSettlement(null);
    setBatchInfo(null);
    setDecoded(null);

    try {
      const sr = await fetch(`/api/marketplace/settlement/${id}`);
      if (!sr.ok) throw new Error(`settlement lookup ${sr.status}`);
      const s = (await sr.json()) as Settlement;
      setSettlement(s);

      const settled = s.status === "completed" || s.status === "confirmed";
      if (settled) {
        const br = await fetch(`/api/marketplace/batch-tx/${id}`);
        if (br.ok) {
          const bi = (await br.json()) as BatchInfo;
          setBatchInfo(bi);
          if (bi.batchTx) {
            const dr = await fetch(`/api/marketplace/decode-batch/${bi.batchTx}`);
            if (dr.ok) setDecoded((await dr.json()) as DecodedBatch);
          }
        }
      }
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSettlementId) loadTrace(initialSettlementId);
  }, [initialSettlementId, loadTrace]);

  const buyer = settlement?.fromAddress ?? focusBuyer;
  const amountUsdc = settlement
    ? (Number(settlement.amount) / 1e6).toFixed(6)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={settlementId}
          onChange={(e) => setSettlementId(e.target.value)}
          placeholder="Settlement UUID"
          className="w-full sm:max-w-md font-mono text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadTrace(settlementId.trim())}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load trace"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">Lookup failed: {error}</p>
      )}

      {settlement && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Settlement</span>
            <code className="rounded bg-muted px-2 py-0.5 text-xs">{settlement.id}</code>
            <Badge variant={statusVariant(settlement.status)}>{settlement.status}</Badge>
            {amountUsdc && <Badge variant="outline">{amountUsdc} USDC</Badge>}
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-3 font-mono text-xs text-muted-foreground break-all">
            <span>Buyer: {settlement.fromAddress}</span>
            <span className="hidden sm:inline">→</span>
            <span>Seller: {settlement.toAddress}</span>
          </div>

          <TraceStep step={1} title="Buyer signs EIP-712 payment authorization (off-chain)">
            <p>
              Wallet signs <code>TransferWithAuthorization</code> scoped to GatewayWallet. No tx, no gas.
            </p>
          </TraceStep>

          <TraceStep step={2} title="Middleware settles via Circle facilitator">
            <p>Server forwards signed authorization to Circle. Response is a settlement UUID, not a tx hash.</p>
            <ApiCall method="POST" url={`${GATEWAY_API}/v1/x402/settle`} />
            <ApiCall method="GET" url={`${GATEWAY_API}/v1/x402/supported`} />
          </TraceStep>

          <TraceStep step={3} title="Settlement queued">
            <p>Gateway accepts the auth and optimistically debits the buyer. On-chain batch pending.</p>
            <ApiCall method="GET" url={`${GATEWAY_API}/v1/x402/transfers/${settlement.id}`} />
            {buyer && (
              <ApiCall method="GET" url={`${GATEWAY_API}/v1/x402/transfers?from=${buyer}`} />
            )}
          </TraceStep>

          <TraceStep step={4} title="Relayer batches transfers">
            <p>
              Circle relayer calls <code>submitBatch</code> on{" "}
              <code className="text-xs">{GATEWAY_WALLET}</code>. Testnet flush is often ~10 minutes.
            </p>
          </TraceStep>

          <TraceStep step={5} title="On-chain submitBatch tx">
            {batchInfo?.batchTx ? (
              <>
                <a
                  href={batchInfo.explorerUrl ?? `${ARC_EXPLORER}/tx/${batchInfo.batchTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-[#ff8a3d] hover:underline"
                >
                  {batchInfo.batchTx}
                </a>
                {decoded && (
                  <div className="mt-3 space-y-3">
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-xs">
                        <tbody>
                          <tr className="border-b"><td className="p-2 text-muted-foreground">batch id</td><td className="p-2 font-mono">{decoded.batchId}</td></tr>
                          <tr className="border-b"><td className="p-2 text-muted-foreground">domain</td><td className="p-2">{decoded.domain} (Arc)</td></tr>
                          <tr className="border-b"><td className="p-2 text-muted-foreground">relayer</td><td className="p-2 font-mono">{decoded.relayer}</td></tr>
                          <tr><td className="p-2 text-muted-foreground">block</td><td className="p-2">{decoded.blockNumber}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-foreground">Per-buyer deltas</p>
                      <div className="overflow-x-auto rounded border">
                        <table className="w-full font-mono text-xs">
                          <thead><tr className="border-b bg-muted/50"><th className="p-2 text-left">address</th><th className="p-2 text-right">delta</th></tr></thead>
                          <tbody>
                            {decoded.entries.map((e) => {
                              const isYou = buyer && e.address.toLowerCase() === buyer.toLowerCase();
                              const v = e.usdc.startsWith("-") ? e.usdc : `+${e.usdc}`;
                              return (
                                <tr key={e.address} className="border-b">
                                  <td className="p-2">
                                    {e.address}
                                    {isYou && <Badge className="ml-2" variant="default">you</Badge>}
                                  </td>
                                  <td className={`p-2 text-right ${e.usdc.startsWith("-") ? "text-destructive" : "text-[#c8f135]"}`}>
                                    {v} USDC
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p>
                {settlement.status === "completed" || settlement.status === "confirmed"
                  ? "Batch tx not found in recent indexer window — try refreshing."
                  : "Pending — re-open after status flips to completed."}
              </p>
            )}
          </TraceStep>

          <TraceStep step={6} title="Settlement marked completed">
            <p>
              <span className="text-muted-foreground">createdAt:</span>{" "}
              <span className="font-mono">{settlement.createdAt}</span>
              <br />
              <span className="text-muted-foreground">updatedAt:</span>{" "}
              <span className="font-mono">{settlement.updatedAt}</span>
            </p>
          </TraceStep>
        </>
      )}
    </div>
  );
}