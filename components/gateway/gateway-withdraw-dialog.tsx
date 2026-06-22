"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BanknoteArrowDown,
  Bot,
  Coins,
  Loader2,
  Sparkles,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CHAIN_EXPLORERS: Record<string, string> = {
  arcTestnet: "https://testnet.arcscan.app/tx/",
  baseSepolia: "https://sepolia.basescan.org/tx/",
  sepolia: "https://sepolia.etherscan.io/tx/",
  arbitrumSepolia: "https://sepolia.arbiscan.io/tx/",
  optimismSepolia: "https://sepolia-optimism.etherscan.io/tx/",
  avalancheFuji: "https://testnet.snowscan.xyz/tx/",
  polygonAmoy: "https://amoy.polygonscan.com/tx/",
};

const SUPPORTED_CHAINS = [
  { value: "arcTestnet", label: "Arc Testnet", hint: "Instant · same chain" },
  { value: "baseSepolia", label: "Base Sepolia", hint: "Cross-chain · needs dest gas" },
  { value: "sepolia", label: "Ethereum Sepolia", hint: "Cross-chain · needs dest gas" },
  { value: "arbitrumSepolia", label: "Arbitrum Sepolia", hint: "Cross-chain · needs dest gas" },
  { value: "optimismSepolia", label: "Optimism Sepolia", hint: "Cross-chain · needs dest gas" },
  { value: "avalancheFuji", label: "Avalanche Fuji", hint: "Cross-chain · needs dest gas" },
  { value: "polygonAmoy", label: "Polygon Amoy", hint: "Cross-chain · needs dest gas" },
] as const;

export type WithdrawDialogRole = "seller" | "agent";

type GatewayWithdrawDialogProps = {
  role: WithdrawDialogRole;
  maxAvailable: string;
  walletAddress?: string | null;
  nativeGas?: string | null;
  walletUsdc?: string | null;
  sellerKeyConfigured?: boolean;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  triggerClassName?: string;
};

const ROLE_META: Record<
  WithdrawDialogRole,
  {
    label: string;
    title: string;
    description: string;
    accent: string;
    accentBg: string;
    accentBorder: string;
    Icon: typeof Store;
  }
> = {
  seller: {
    label: "Seller earnings",
    title: "Withdraw earnings",
    description: "Move x402 revenue from your seller Gateway balance back to a wallet.",
    accent: "text-[#ff8a3d]",
    accentBg: "bg-[#ff8a3d]/10",
    accentBorder: "border-[#ff8a3d]/35",
    Icon: Store,
  },
  agent: {
    label: "Agent deposit",
    title: "Withdraw Gateway deposit",
    description: "Recover unused USDC you deposited into Gateway for agent payments.",
    accent: "text-[#f5c842]",
    accentBg: "bg-[#f5c842]/10",
    accentBorder: "border-[#f5c842]/35",
    Icon: Bot,
  },
};

export function GatewayWithdrawDialog({
  role,
  maxAvailable,
  walletAddress,
  nativeGas,
  walletUsdc,
  sellerKeyConfigured = true,
  onSuccess,
  trigger,
  triggerClassName,
}: GatewayWithdrawDialogProps) {
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState("arcTestnet");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const meta = ROLE_META[role];
  const RoleIcon = meta.Icon;
  const maxNum = Number(maxAvailable);
  const hasBalance = !Number.isNaN(maxNum) && maxNum > 0;
  const canSubmit = hasBalance && (role !== "seller" || sellerKeyConfigured);
  const selectedChain = SUPPORTED_CHAINS.find((c) => c.value === chain);

  const gasWarning = useMemo(() => {
    const gas = nativeGas ? Number(nativeGas) : null;
    if (gas !== null && !Number.isNaN(gas) && gas < 0.003) {
      return "Low native USDC for Arc gas — fund via Circle faucet before withdrawing.";
    }
    return null;
  }, [nativeGas]);

  async function handleWithdraw() {
    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Invalid amount", { description: "Enter a positive USDC amount." });
      return;
    }

    if (hasBalance && parsedAmount > maxNum) {
      toast.error("Amount exceeds balance", {
        description: `Maximum available: ${maxAvailable} USDC`,
      });
      return;
    }

    if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast.error("Invalid address", {
        description: "Destination must be 0x followed by 40 hex characters.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/gateway/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          amount,
          destinationChain: chain,
          destinationAddress: address || undefined,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        txHash?: string;
        amount?: string;
        destinationChain?: string;
        recipient?: string;
      };

      if (!res.ok) {
        toast.error("Withdrawal failed", { description: data.error ?? "Unknown error" });
        return;
      }

      setAmount("");
      setOpen(false);
      onSuccess?.();

      const explorer = data.destinationChain && CHAIN_EXPLORERS[data.destinationChain];
      toast.success(`Withdrawn ${data.amount ?? amount} USDC`, {
        description: data.txHash
          ? explorer
            ? `View on explorer`
            : `tx: ${data.txHash}`
          : "Settlement confirmed",
        action: explorer && data.txHash
          ? {
              label: "Explorer",
              onClick: () => window.open(`${explorer}${data.txHash}`, "_blank"),
            }
          : undefined,
        duration: 12000,
      });
    } catch (err) {
      toast.error("Withdrawal failed", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const defaultTrigger =
    role === "seller" ? (
      <Button variant="outline" size="sm" className={cn("gap-2", triggerClassName)}>
        <BanknoteArrowDown size={14} />
        Withdraw
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-7 border-[#f5c842]/35 text-[10px] font-mono text-[#f5c842] hover:bg-[#f5c842]/10",
          triggerClassName,
        )}
      >
        <BanknoteArrowDown size={11} />
        Withdraw Gateway
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent
        className={cn(
          "border-[#1f1f1f] bg-[#0a0a0a] p-0 overflow-hidden gap-0",
          "sm:max-w-lg shadow-[0_0_0_1px_rgba(255,138,61,0.1),0_24px_64px_-24px_rgba(0,0,0,0.8)]",
        )}
      >
        <div className="relative px-5 pt-5 pb-4 border-b border-[#1f1f1f]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl opacity-20",
              role === "seller" ? "bg-[#ff8a3d]" : "bg-[#f5c842]",
            )}
          />

          <DialogHeader className="relative text-left space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "border hover:bg-transparent text-[10px]",
                  meta.accentBg,
                  meta.accent,
                  meta.accentBorder,
                )}
              >
                <RoleIcon size={11} className="mr-1" />
                {meta.label}
              </Badge>
              <Badge variant="outline" className="border-[#333] text-[#888] bg-transparent font-mono text-[10px]">
                Circle Gateway
              </Badge>
            </div>
            <DialogTitle className="text-lg tracking-wide text-[#f5f5f5]">{meta.title}</DialogTitle>
            <DialogDescription className="font-mono text-xs text-[#666] leading-relaxed">
              {meta.description}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded border border-[#1f1f1f] bg-[#111]/90 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-[#666] font-mono">Gateway</p>
              <p className={cn("mt-1 font-mono text-lg font-semibold tabular-nums", meta.accent)}>
                ${maxAvailable}
              </p>
              <p className="text-[10px] text-[#555] font-mono">available USDC</p>
            </div>
            <div className="rounded border border-[#1f1f1f] bg-[#111]/90 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-[#666] font-mono">Wallet</p>
              <p className="mt-1 font-mono text-sm text-[#f5f5f5] truncate">
                {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "—"}
              </p>
              <p className="text-[10px] text-[#555] font-mono">
                {walletUsdc ? `${walletUsdc} USDC` : nativeGas ? `${nativeGas} native gas` : "Arc Testnet"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {role === "seller" && !sellerKeyConfigured && (
            <p className="rounded border border-[#ff8a3d]/35 bg-[#ff8a3d]/8 px-3 py-2 font-mono text-[10px] text-[#ff8a3d] leading-relaxed">
              SELLER_PRIVATE_KEY missing — run{" "}
              <code className="text-[#f5f5f5]">npm run generate-wallets</code> to enable withdrawals
              (your buyer keys are preserved).
            </p>
          )}

          {gasWarning && (
            <p className="rounded border border-[#f5c842]/30 bg-[#f5c842]/8 px-3 py-2 font-mono text-[10px] text-[#f5c842] leading-relaxed">
              {gasWarning}
            </p>
          )}

          {!hasBalance && (
            <p className="rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-[10px] text-[#888] leading-relaxed">
              {role === "seller"
                ? "No seller Gateway balance yet. Earnings appear here after x402 payments settle."
                : "No Gateway deposit to withdraw. Deposit USDC first, or spend the remaining balance on citations."}
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-[#888] font-mono">
              Destination chain
            </Label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {SUPPORTED_CHAINS.map((supportedChain) => {
                const selected = chain === supportedChain.value;
                return (
                  <button
                    key={supportedChain.value}
                    type="button"
                    disabled={submitting}
                    onClick={() => setChain(supportedChain.value)}
                    className={cn(
                      "shrink-0 rounded border px-3 py-2 text-left transition-colors min-w-[7rem]",
                      selected
                        ? cn(meta.accentBg, meta.accentBorder, "ring-1 ring-inset")
                        : "border-[#2a2a2a] bg-[#111] hover:border-[#444]",
                    )}
                  >
                    <p className={cn("text-xs font-medium", selected ? meta.accent : "text-[#ccc]")}>
                      {supportedChain.label}
                    </p>
                    <p className="font-mono text-[9px] text-[#666] mt-0.5">{supportedChain.hint}</p>
                  </button>
                );
              })}
            </div>
            {selectedChain?.value !== "arcTestnet" && (
              <p className="font-mono text-[10px] text-[#666] flex items-center gap-1">
                <Sparkles size={10} className={meta.accent} />
                Cross-chain withdrawals need native gas on {selectedChain?.label}.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`withdraw-addr-${role}`} className="text-[10px] uppercase tracking-wider text-[#888] font-mono">
              Recipient (optional)
            </Label>
            <Input
              id={`withdraw-addr-${role}`}
              placeholder={walletAddress ? `Defaults to ${walletAddress.slice(0, 6)}…` : "0x…"}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono text-xs border-[#1f1f1f] bg-[#111] text-[#f5f5f5]"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`withdraw-amt-${role}`} className="text-[10px] uppercase tracking-wider text-[#888] font-mono">
                Amount (USDC)
              </Label>
              {hasBalance && (
                <button
                  type="button"
                  className={cn("font-mono text-[10px] hover:underline", meta.accent)}
                  onClick={() => setAmount(maxAvailable)}
                  disabled={submitting}
                >
                  Max {maxAvailable}
                </button>
              )}
            </div>
            <div className="relative">
              <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              <Input
                id={`withdraw-amt-${role}`}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9 font-mono border-[#1f1f1f] bg-[#111] text-[#f5f5f5]"
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#1f1f1f] px-5 py-4">
          <Button
            onClick={() => void handleWithdraw()}
            disabled={submitting || !amount || !canSubmit}
            className={cn(
              "w-full font-semibold",
              role === "seller"
                ? "bg-[#ff8a3d] text-[#0a0a0a] hover:bg-[#ff8a3d]/90"
                : "bg-[#f5c842] text-[#0a0a0a] hover:bg-[#f5c842]/90",
            )}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                Withdrawing…
              </>
            ) : (
              <>
                <ArrowUpRight size={14} className="mr-2" />
                Withdraw to {selectedChain?.label ?? "chain"}
              </>
            )}
          </Button>
          <p className="mt-2 text-center font-mono text-[9px] text-[#555]">
            Arc gas is paid in native USDC · instant on Arc Testnet
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}