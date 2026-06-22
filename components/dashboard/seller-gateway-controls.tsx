"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GatewayWithdrawDialog } from "@/components/gateway/gateway-withdraw-dialog";
import { GatewayBalanceDialog, type GatewayBalances } from "./gateway-balance-dialog";
import { Button } from "@/components/ui/button";

/** Operator-only seller earnings pool (x402 + attestation platform fees). */
export function SellerGatewayControls() {
  const [balances, setBalances] = useState<GatewayBalances | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gateway/balance");
      if (res.ok) {
        setBalances((await res.json()) as GatewayBalances);
      }
    } catch {
      setBalances(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  if (!balances?.walletAddress) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        Seller wallet not configured — set SELLER_ADDRESS to withdraw platform fees.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="rounded border border-[#ff8a3d]/25 bg-[#111] px-3 py-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          Seller Gateway
        </p>
        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#ff8a3d]">
          {loading && !balances ? (
            <Loader2 size={16} className="animate-spin inline" />
          ) : (
            `$${balances.gateway.available}`
          )}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">available USDC</p>
      </div>
      <GatewayBalanceDialog
        balances={balances}
        loading={loading}
        onRefresh={fetchBalances}
        variant="seller"
        trigger={
          <Button variant="outline" size="sm" className="border-[#333] text-xs">
            Balance details
          </Button>
        }
      />
      <GatewayWithdrawDialog
        role="seller"
        maxAvailable={balances.gateway.available}
        walletAddress={balances.walletAddress}
        nativeGas={balances.nativeGas}
        walletUsdc={balances.wallet.balance}
        sellerKeyConfigured={balances.sellerKeyConfigured ?? false}
        onSuccess={fetchBalances}
      />
    </div>
  );
}