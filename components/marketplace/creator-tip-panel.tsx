"use client";

import { useCallback, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { payViaAgentWallet } from "@/lib/gateway-pay";
import { truncateMemo } from "@/lib/payment-memo";
import { MIN_TIP_USDC } from "@/lib/creator-tip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRESETS = ["0.1", "0.5", "1", "5"] as const;

type Props = {
  username: string;
  disabled?: boolean;
  className?: string;
};

export function CreatorTipPanel({ username, disabled, className }: Props) {
  const [amount, setAmount] = useState("0.1");
  const [busy, setBusy] = useState(false);

  const sendTip = useCallback(async () => {
    if (disabled || busy) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n < MIN_TIP_USDC) {
      toast.error("Invalid tip", {
        description: `Minimum tip is ${MIN_TIP_USDC} USDC`,
      });
      return;
    }

    setBusy(true);
    try {
      const path = `/api/marketplace/tip?username=${encodeURIComponent(username)}&amount=${encodeURIComponent(String(n))}`;
      const memo = truncateMemo(`tip:@${username} amount:${n}`);
      const result = await payViaAgentWallet({
        path,
        method: "GET",
        memo,
      });
      toast.success(`Tipped @${username}`, {
        description: `${result.formattedAmount ?? `${n} USDC`} sent to their payout wallet`,
      });
    } catch (err) {
      toast.error("Tip failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [amount, busy, disabled, username]);

  return (
    <div
      className={cn(
        "rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3 space-y-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Coins size={14} className="text-[#f5c842]" />
        <p className="text-sm font-semibold tracking-wide">Tip researcher</p>
      </div>
      <p className="font-mono text-[10px] text-[#666] leading-relaxed">
        Send USDC from your agent Gateway balance. Settles to their payout wallet
        (not an unlock).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={cn(
              "rounded border px-2 py-1 font-mono text-[10px] transition-colors",
              amount === p
                ? "border-[#f5c842]/40 text-[#f5c842] bg-[#f5c842]/10"
                : "border-[#333] text-[#888] hover:border-[#555]",
            )}
          >
            ${p}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy || disabled}
          className="h-8 w-24 border-[#333] bg-[#0a0a0a] font-mono text-xs"
          aria-label="Tip amount in USDC"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || disabled}
          onClick={() => void sendTip()}
          className="h-8 gap-1.5 border-[#f5c842]/35 font-mono text-xs text-[#f5c842] hover:bg-[#f5c842]/10"
        >
          {busy ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Sending…
            </>
          ) : (
            <>Tip ${amount || "…"}</>
          )}
        </Button>
      </div>
    </div>
  );
}
