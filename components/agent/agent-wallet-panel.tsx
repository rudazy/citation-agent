"use client";

import { useState } from "react";
import { Bot, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentWalletStatusResponse } from "@/lib/attestation-client";

type AgentWalletPanelProps = {
  wallet: AgentWalletStatusResponse | null;
  loading: boolean;
  creating: boolean;
  busy?: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  minUsdc?: number;
  showGatewayBalance?: boolean;
};

export function AgentWalletPanel({
  wallet,
  loading,
  creating,
  busy = false,
  onRefresh,
  onCreate,
  minUsdc,
  showGatewayBalance = false,
}: AgentWalletPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Agent wallet copied", {
        description: "Paste into the Circle faucet to fund on Arc Testnet.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy address");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
        <Loader2 size={12} className="animate-spin" />
        Loading agent wallet…
      </div>
    );
  }

  if (wallet?.configured && wallet.address) {
    const walletBalance = wallet.usdcBalance ? parseFloat(wallet.usdcBalance) : null;
    const gatewayBalance = wallet.gatewayUsdc ? parseFloat(wallet.gatewayUsdc) : null;
    const needsWalletFunds =
      minUsdc !== undefined &&
      walletBalance !== null &&
      !Number.isNaN(walletBalance) &&
      walletBalance < minUsdc;
    const needsGatewayFunds =
      showGatewayBalance &&
      minUsdc !== undefined &&
      gatewayBalance !== null &&
      !Number.isNaN(gatewayBalance) &&
      gatewayBalance < minUsdc;

    return (
      <div className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#f5c842]/10 text-[#f5c842] border border-[#f5c842]/25 hover:bg-[#f5c842]/10 text-[9px]">
            {wallet.label ?? "Circle Agent Stack"}
          </Badge>
          <button
            type="button"
            onClick={() => void copyAddress(wallet.address!)}
            className="inline-flex items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#141414] px-2 py-1 font-mono text-[10px] text-[#a3a3a3] hover:border-[#f5c842]/35 hover:text-[#f5f5f5] transition-colors"
            title="Copy full address for Circle faucet"
          >
            {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
            {copied ? <Check size={10} className="text-[#c8f135]" /> : <Copy size={10} />}
          </button>
          <span className="font-mono text-[10px] text-[#666]">
            · {wallet.usdcBalance ?? "—"} USDC
            {showGatewayBalance ? ` · Gateway ${wallet.gatewayUsdc ?? "—"}` : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void copyAddress(wallet.address!)}
            className="h-7 border-[#333] text-[10px] font-mono text-[#ccc] hover:bg-[#141414]"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            Copy for faucet
          </Button>
          {wallet.faucetUrl && (
            <a
              href={wallet.faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10px] text-[#f5c842] hover:underline"
            >
              Open Circle faucet
              <ExternalLink size={10} />
            </a>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="font-mono text-[10px] text-[#666] hover:text-[#a3a3a3] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {needsWalletFunds && (
          <p className="font-mono text-[10px] text-destructive">
            Need {minUsdc} USDC in agent wallet — copy address above and fund via Circle faucet.
          </p>
        )}
        {needsGatewayFunds && !needsWalletFunds && (
          <p className="font-mono text-[10px] text-[#ff8a3d]">
            Wallet funded. Deposit to Gateway before paying (Gateway: {wallet.gatewayUsdc ?? "0"} USDC).
          </p>
        )}
      </div>
    );
  }

  if (wallet?.canProvision) {
    return (
      <div className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-2.5 space-y-2">
        <p className="font-mono text-[10px] text-[#666]">
          No agent wallet yet. Create one, copy the address, and fund it on the Circle faucet.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || creating}
          onClick={onCreate}
          className="h-8 border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10"
        >
          {creating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Bot size={12} />
              Create agent wallet
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <p className="font-mono text-[10px] text-[#666]">
      Run <code className="text-[#a3a3a3]">npm run generate-wallets</code> to configure the agent
      wallet.
    </p>
  );
}