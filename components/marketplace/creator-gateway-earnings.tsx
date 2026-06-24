"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";
import { Loader2, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWalletUsdcBalance } from "@/lib/gateway-metamask";
import { withdrawGatewayViaMetaMask } from "@/lib/gateway-metamask-withdraw";
import { switchToArcTestnet } from "@/lib/attestation-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { toast } from "sonner";

type Props = {
  connected: `0x${string}` | null;
  payoutWalletInput: string;
};

function resolvePayoutAddress(
  connected: `0x${string}` | null,
  payoutWalletInput: string,
): `0x${string}` | null {
  const raw = payoutWalletInput.trim();
  if (raw) {
    try {
      return getAddress(raw);
    } catch {
      return null;
    }
  }
  return connected;
}

export function CreatorGatewayEarnings({ connected, payoutWalletInput }: Props) {
  const [walletUsdc, setWalletUsdc] = useState<string | null>(null);
  const [gatewayUsdc, setGatewayUsdc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const payoutAddress = useMemo(
    () => resolvePayoutAddress(connected, payoutWalletInput),
    [connected, payoutWalletInput],
  );

  const canWithdraw =
    connected &&
    payoutAddress &&
    connected.toLowerCase() === payoutAddress.toLowerCase();

  const refreshBalances = useCallback(async () => {
    if (!payoutAddress) {
      setWalletUsdc(null);
      setGatewayUsdc(null);
      return;
    }
    setLoading(true);
    try {
      const [wallet, gatewayRes] = await Promise.all([
        getWalletUsdcBalance(payoutAddress),
        fetch(`/api/marketplace/gateway-balance?address=${payoutAddress}`),
      ]);
      setWalletUsdc(wallet);
      if (gatewayRes.ok) {
        const data = (await gatewayRes.json()) as { gateway_usdc?: string };
        setGatewayUsdc(data.gateway_usdc ?? "0");
      } else {
        setGatewayUsdc(null);
      }
    } catch {
      setWalletUsdc(null);
      setGatewayUsdc(null);
    } finally {
      setLoading(false);
    }
  }, [payoutAddress]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  const runWithdraw = useCallback(async () => {
    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum || !connected || !payoutAddress || !canWithdraw) {
      toast.error("Connect the payout wallet to withdraw");
      return;
    }

    const amount = withdrawAmount.trim() || gatewayUsdc || "";
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount to withdraw");
      return;
    }

    setWithdrawing(true);
    try {
      await switchToArcTestnet(ethereum);
      const result = await withdrawGatewayViaMetaMask(ethereum, connected, amount);
      toast.success("Withdrawn to wallet", {
        description: `${result.amount} USDC — check wallet balance on Arc`,
      });
      setWithdrawAmount("");
      await refreshBalances();
    } catch (err) {
      if ((err as { code?: number }).code === 4001) {
        toast.message("Withdrawal cancelled");
        return;
      }
      toast.error("Withdraw failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setWithdrawing(false);
    }
  }, [canWithdraw, connected, gatewayUsdc, payoutAddress, refreshBalances, withdrawAmount]);

  if (!payoutAddress) {
    return (
      <p className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-2 font-mono text-[10px] text-[#666]">
        Connect a wallet or enter a valid payout address to view unlock earnings.
      </p>
    );
  }

  const shortPayout = `${payoutAddress.slice(0, 6)}…${payoutAddress.slice(-4)}`;
  const gatewayNum = gatewayUsdc !== null ? Number(gatewayUsdc) : null;
  const hasGateway = gatewayNum !== null && !Number.isNaN(gatewayNum) && gatewayNum > 0;

  return (
    <div className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#666]">
            Unlock earnings · {shortPayout}
          </p>
          <p className="font-mono text-[10px] text-[#666] leading-relaxed max-w-prose">
            Reader payments land in Circle Gateway for this payout address — not wallet USDC until
            you withdraw.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => void refreshBalances()}
          className="h-7 px-2 text-[10px] font-mono text-[#888] hover:text-[#f5f5f5]"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] px-2.5 py-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-[#555]">Gateway</p>
          <p className="font-mono text-sm tabular-nums text-[#f5c842]">
            {loading && gatewayUsdc === null ? "…" : `$${gatewayUsdc ?? "0"}`}
          </p>
        </div>
        <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] px-2.5 py-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-[#555]">Wallet USDC</p>
          <p className="font-mono text-sm tabular-nums text-[#a3a3a3]">
            {loading && walletUsdc === null ? "…" : `$${walletUsdc ?? "0"}`}
          </p>
        </div>
      </div>

      {!canWithdraw && (
        <p className="font-mono text-[10px] text-[#666]">
          Connect the payout wallet ({shortPayout}) to withdraw earnings to wallet USDC.
        </p>
      )}

      {canWithdraw && hasGateway && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder={gatewayUsdc ?? "0"}
            className="h-8 max-w-[120px] border-[#333] bg-[#141414] font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={withdrawing}
            onClick={() => void runWithdraw()}
            className="h-8 gap-1.5 border-[#333] font-mono text-[10px] text-[#a3a3a3] hover:text-[#f5f5f5]"
          >
            {withdrawing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wallet size={12} />
            )}
            Withdraw to wallet
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={withdrawing || !gatewayUsdc}
            onClick={() => setWithdrawAmount(gatewayUsdc ?? "")}
            className="h-8 font-mono text-[10px] text-[#666]"
          >
            Max
          </Button>
        </div>
      )}

      {canWithdraw && !hasGateway && !loading && (
        <p className="font-mono text-[10px] text-[#666]">
          No Gateway earnings yet — unlock payments will appear here after readers pay.
        </p>
      )}
    </div>
  );
}