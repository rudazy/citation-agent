"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GatewayBalanceDialog, type GatewayBalances } from "./gateway-balance-dialog";
import { GatewayWithdrawDialog } from "@/components/gateway/gateway-withdraw-dialog";
import { Info, Loader2 } from "lucide-react";
import { fetchAgentWalletStatus, type AgentWalletStatusResponse } from "@/lib/attestation-client";

function toGatewayBalances(wallet: AgentWalletStatusResponse): GatewayBalances | null {
  if (!wallet.configured || !wallet.address) return null;
  return {
    configured: true,
    walletAddress: wallet.address,
    nativeGas: wallet.nativeGas ?? "0",
    wallet: { balance: wallet.usdcBalance ?? "0" },
    gateway: wallet.gateway ?? {
      total: wallet.gatewayUsdc ?? "0",
      available: wallet.gatewayUsdc ?? "0",
      withdrawing: "0",
      withdrawable: "0",
    },
  };
}

export function TopBarGatewayControls() {
  const [wallet, setWallet] = useState<AgentWalletStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const walletRef = useRef<AgentWalletStatusResponse | null>(null);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAgentWalletStatus();
      walletRef.current = next;
      setWallet(next);
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  const balances = wallet ? toGatewayBalances(wallet) : null;
  const available = balances?.gateway.available ?? "0";
  const hasWallet = wallet?.configured === true && !!wallet.address;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {hasWallet ? (
        <GatewayWithdrawDialog
          role="agent"
          maxAvailable={available}
          walletAddress={wallet?.address}
          nativeGas={wallet?.nativeGas}
          walletUsdc={wallet?.usdcBalance}
          onSuccess={fetchBalances}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-[#f5c842]/35 text-[10px] sm:text-xs text-[#f5c842] hover:bg-[#f5c842]/10"
            >
              Withdraw
            </Button>
          }
        />
      ) : null}
      <Badge
        variant="outline"
        className="gap-1 text-[10px] sm:text-xs border-[#f5c842]/25 bg-[#f5c842]/5 max-w-[4.5rem] sm:max-w-none"
      >
        <span className="text-muted-foreground font-sans hidden sm:inline">Your Gateway</span>
        <span className="font-mono leading-none inline-flex items-center gap-1">
          {loading && !wallet ? <Loader2 size={12} className="animate-spin" /> : null}
          {hasWallet ? `$${available}` : loading ? "…" : "—"}
        </span>
        {hasWallet && balances ? (
          <GatewayBalanceDialog
            balances={balances}
            loading={loading}
            onRefresh={fetchBalances}
            variant="agent"
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 -mr-0.5"
                aria-label="Open your gateway balance details"
              >
                <Info size={12} className="text-muted-foreground" />
              </Button>
            }
          />
        ) : null}
      </Badge>
    </div>
  );
}