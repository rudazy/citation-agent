"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GatewayBalanceDialog, type GatewayBalances } from "./gateway-balance-dialog";
import { WithdrawDialog } from "./withdraw-dialog";
import { Info, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function TopBarGatewayControls() {
  const [balances, setBalances] = useState<GatewayBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const balancesRef = useRef<GatewayBalances | null>(null);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gateway/balance");
      if (res.ok) {
        const next: GatewayBalances = await res.json();
        const prev = balancesRef.current;
        if (prev && prev.gateway.available !== next.gateway.available) {
          toast.success("Gateway balance updated", {
            description: `Available: $${next.gateway.available} USDC`,
          });
        }
        balancesRef.current = next;
        setBalances(next);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("balance-refresh")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payment_events" },
        () => fetchBalances(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "withdrawals" },
        () => fetchBalances(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchBalances();
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBalances]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <WithdrawDialog
        maxAvailable={balances?.gateway.available ?? "0"}
        onWithdraw={fetchBalances}
      />
      <Badge
        variant="outline"
        className="gap-1 text-[10px] sm:text-xs border-[#ff8a3d]/25 bg-[#ff8a3d]/5 max-w-[4.5rem] sm:max-w-none"
      >
        <span className="text-muted-foreground font-sans hidden sm:inline">Gateway</span>
        <span className="font-mono leading-none inline-flex items-center gap-1">
          {loading && !balances ? <Loader2 size={12} className="animate-spin" /> : null}
          {balances ? `$${balances.gateway.available}` : loading ? "…" : "—"}
        </span>
        <GatewayBalanceDialog
          balances={balances}
          loading={loading}
          onRefresh={fetchBalances}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 -mr-0.5"
              aria-label="Open gateway balance details"
            >
              <Info size={12} className="text-muted-foreground" />
            </Button>
          }
        />
      </Badge>
    </div>
  );
}