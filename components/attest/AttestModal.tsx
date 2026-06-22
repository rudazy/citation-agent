"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Bot,
  CheckCircle2,
  ExternalLink,
  Globe,
  Hash,
  Linkedin,
  Loader2,
  Shield,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AgentWalletPanel } from "@/components/agent/agent-wallet-panel";
import { cn } from "@/lib/utils";
import {
  ATTESTATION_PLATFORM_FEE_USDC,
  MIN_CLAIM_CHARS,
  MIN_STAKE_USDC,
  totalAttestationCostUsdc,
} from "@/lib/attestation";
import {
  attestViaAgentWallet,
  attestViaConnectedWallet,
  buildTargetFromPreset,
  canonicalizeAttestationTarget,
  classifyTarget,
  fetchAgentWalletStatus,
  formatTargetLabel,
  getAttestationContractAddress,
  getConnectedAccount,
  inferTargetPreset,
  provisionAgentWallet,
  readWalletUsdcBalance,
  recordAttestationPlatformFeeOnServer,
  targetInputFromProp,
  validateTargetInput,
  type AgentWalletStatusResponse,
  type TargetKind,
  type TargetPreset,
} from "@/lib/attestation-client";

import "@/lib/ethereum-provider";

const STAKE_PRESETS = [0.1, 0.25, 0.5, 1] as const;
const EXPLORER = "https://testnet.arcscan.app/tx/";

type WalletMode = "connected" | "agent";
type Phase = "idle" | "approving" | "attesting" | "success";

const TARGET_PRESETS: {
  id: TargetPreset;
  label: string;
  icon: LucideIcon;
  placeholder: string;
  hint: string;
}[] = [
  {
    id: "x",
    label: "X Account",
    icon: AtSign,
    placeholder: "@trustgated or x.com/username",
    hint: "Handle or profile URL",
  },
  {
    id: "wallet",
    label: "Wallet / Contract",
    icon: Wallet,
    placeholder: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    hint: "EOA or contract on any chain",
  },
  {
    id: "website",
    label: "Website",
    icon: Globe,
    placeholder: "https://trustgated.xyz",
    hint: "Domain or full URL",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    placeholder: "linkedin.com/in/username",
    hint: "Profile or company page",
  },
  {
    id: "agent",
    label: "Agent",
    icon: Bot,
    placeholder: "0x… agent wallet or citation-agent-01",
    hint: "Research agent wallet or agent id",
  },
  {
    id: "custom",
    label: "Custom",
    icon: Hash,
    placeholder: "citation:trust-infrastructure, author:name, …",
    hint: "Any verifiable target string",
  },
];

const TARGET_META: Record<
  TargetKind,
  { label: string; icon: LucideIcon; accent: string }
> = {
  wallet: { label: "Wallet", icon: Wallet, accent: "text-[#f5c842]" },
  website: { label: "Website", icon: Globe, accent: "text-[#ff8a3d]" },
  social: { label: "X Account", icon: AtSign, accent: "text-[#c8f135]" },
  linkedin: { label: "LinkedIn", icon: Linkedin, accent: "text-[#f5c842]" },
  agent: { label: "Agent", icon: Bot, accent: "text-[#ff8a3d]" },
  other: { label: "Custom", icon: Hash, accent: "text-[#a3a3a3]" },
};

export interface AttestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional seed when opened from dashboard/marketplace row actions */
  target?: string;
  onSuccess?: (txHash: string) => void;
}

export function AttestModal({ isOpen, onClose, target: targetSeed = "", onSuccess }: AttestModalProps) {
  const [targetPreset, setTargetPreset] = useState<TargetPreset>("custom");
  const [targetInput, setTargetInput] = useState("");
  const [claim, setClaim] = useState("");
  const [stake, setStake] = useState(MIN_STAKE_USDC);
  const [walletMode, setWalletMode] = useState<WalletMode>("agent");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<`0x${string}` | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [agentWallet, setAgentWallet] = useState<AgentWalletStatusResponse | null>(null);
  const [agentWalletLoading, setAgentWalletLoading] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);

  const contractAddress = getAttestationContractAddress();
  const resolvedTarget = useMemo(
    () => buildTargetFromPreset(targetPreset, targetInput),
    [targetPreset, targetInput],
  );
  const targetError = useMemo(
    () => (targetInput.trim() ? validateTargetInput(targetPreset, targetInput) : "Enter a target"),
    [targetPreset, targetInput],
  );
  const targetKind = useMemo(
    () => (resolvedTarget ? classifyTarget(resolvedTarget) : "other"),
    [resolvedTarget],
  );
  const targetMeta = TARGET_META[targetKind];
  const TargetIcon = targetMeta.icon;
  const activePresetMeta = TARGET_PRESETS.find((p) => p.id === targetPreset) ?? TARGET_PRESETS[4];

  const busy = phase === "approving" || phase === "attesting";
  const stakeValid = !Number.isNaN(stake) && stake >= MIN_STAKE_USDC;
  const claimValid = claim.trim().length >= MIN_CLAIM_CHARS;
  const targetValid = !!resolvedTarget && !targetError;
  const agentUsdcBalance = useMemo(() => {
    if (!agentWallet?.usdcBalance) return null;
    const parsed = parseFloat(agentWallet.usdcBalance);
    return Number.isNaN(parsed) ? null : parsed;
  }, [agentWallet?.usdcBalance]);

  const totalCostUsdc = totalAttestationCostUsdc(stake);

  const agentBalanceSufficient =
    walletMode !== "agent" ||
    agentUsdcBalance === null ||
    agentUsdcBalance >= totalCostUsdc;

  const agentWalletReady = walletMode !== "agent" || agentWallet?.configured === true;
  const canSubmit =
    stakeValid &&
    claimValid &&
    targetValid &&
    !!contractAddress &&
    !busy &&
    agentWalletReady &&
    agentBalanceSufficient &&
    !agentWalletLoading;

  const submitBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!contractAddress) blockers.push("Attestation contract not configured");
    if (!targetInput.trim()) blockers.push("Enter a target (e.g. @trustgated)");
    else if (targetError) blockers.push(targetError);
    if (!claimValid) blockers.push(`Claim must be at least ${MIN_CLAIM_CHARS} characters`);
    if (!stakeValid) blockers.push(`Stake must be at least ${MIN_STAKE_USDC} USDC`);
    if (walletMode === "agent" && agentWalletLoading) blockers.push("Loading agent wallet…");
    if (walletMode === "agent" && !agentWalletLoading && !agentWalletReady) {
      blockers.push("Create or configure agent wallet");
    }
    if (walletMode === "agent" && agentWalletReady && !agentBalanceSufficient) {
      blockers.push(
        `Agent wallet needs ${totalCostUsdc} USDC (stake + ${ATTESTATION_PLATFORM_FEE_USDC} fee, has ${agentWallet?.usdcBalance ?? "0"})`,
      );
    }
    return blockers;
  }, [
    agentBalanceSufficient,
    agentWallet?.usdcBalance,
    agentWalletLoading,
    agentWalletReady,
    claimValid,
    contractAddress,
    stake,
    stakeValid,
    totalCostUsdc,
    targetError,
    targetInput,
    walletMode,
  ]);

  const seedTargetFields = useCallback((seed: string) => {
    const trimmed = seed.trim();
    if (!trimmed) {
      setTargetPreset("custom");
      setTargetInput("");
      return;
    }
    const preset = inferTargetPreset(trimmed);
    setTargetPreset(preset);
    setTargetInput(targetInputFromProp(trimmed, preset));
  }, []);

  const refreshConnectedWallet = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setConnectedAccount(null);
      setWalletBalance(null);
      return;
    }
    try {
      const account = await getConnectedAccount(ethereum);
      setConnectedAccount(account);
      const balance = await readWalletUsdcBalance(account);
      setWalletBalance(balance);
    } catch {
      setConnectedAccount(null);
      setWalletBalance(null);
    }
  }, []);

  const refreshAgentWallet = useCallback(async () => {
    setAgentWalletLoading(true);
    try {
      const status = await fetchAgentWalletStatus();
      setAgentWallet(status);
    } catch {
      setAgentWallet(null);
    } finally {
      setAgentWalletLoading(false);
    }
  }, []);

  const handleCreateAgentWallet = async () => {
    setCreatingAgent(true);
    try {
      const result = await provisionAgentWallet();
      setAgentWallet(result);
      toast.success("Agent wallet created", {
        description: result.address
          ? `${result.address.slice(0, 6)}…${result.address.slice(-4)} — fund via Circle faucet`
          : "Fund on Arc Testnet via Circle faucet",
      });
    } catch (err) {
      toast.error("Could not create agent wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCreatingAgent(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    seedTargetFields(targetSeed);
    void refreshAgentWallet();
    if (walletMode === "connected") void refreshConnectedWallet();
  }, [
    isOpen,
    targetSeed,
    seedTargetFields,
    refreshAgentWallet,
    refreshConnectedWallet,
    walletMode,
  ]);

  const resetForm = useCallback(() => {
    setPhase("idle");
    setTxHash(null);
    setClaim("");
    setStake(MIN_STAKE_USDC);
    setTargetPreset("custom");
    setTargetInput("");
  }, []);

  const handleClose = () => {
    if (busy) return;
    resetForm();
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  const handleAttest = async () => {
    if (!contractAddress) {
      toast.error("Contract not configured", {
        description: "Set NEXT_PUBLIC_ATTESTATION_ADDRESS in environment.",
      });
      return;
    }

    const validation = validateTargetInput(targetPreset, targetInput);
    if (validation) {
      toast.error("Invalid target", { description: validation });
      return;
    }

    if (!canSubmit || !resolvedTarget) return;

    try {
      if (walletMode === "agent") {
        setPhase("attesting");
        const result = await attestViaAgentWallet({
          target: canonicalizeAttestationTarget(resolvedTarget),
          claim,
          stakeUsdc: stake,
        });
        setTxHash(result.attestTxHash);
        setPhase("success");
        onSuccess?.(result.attestTxHash);
        void refreshAgentWallet();
        toast.success("Attestation recorded", {
          description: `${stake} USDC staked · ${ATTESTATION_PLATFORM_FEE_USDC} USDC platform fee`,
        });
        return;
      }

      const ethereum = window.ethereum;
      if (!ethereum) {
        toast.error("Wallet not found", { description: "Install MetaMask or use Agent wallet." });
        return;
      }

      setPhase("approving");
      const account = await getConnectedAccount(ethereum);
      setConnectedAccount(account);

      const result = await attestViaConnectedWallet({
        ethereum,
        account,
        contractAddress,
        target: canonicalizeAttestationTarget(resolvedTarget),
        claim,
        stakeUsdc: stake,
      });

      setTxHash(result.attestTxHash);
      setPhase("success");
      onSuccess?.(result.attestTxHash);
      try {
        await recordAttestationPlatformFeeOnServer(result.attestTxHash);
      } catch {
        // On-chain fee still settled; dashboard record is best-effort for connected wallets
      }
      toast.success("Attestation recorded", {
        description: `${stake} USDC staked · ${ATTESTATION_PLATFORM_FEE_USDC} USDC platform fee`,
      });
    } catch (err) {
      setPhase("idle");
      toast.error("Attestation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!busy}
        className={cn(
          "border-[#1f1f1f] bg-[#0a0a0a] p-0 overflow-hidden gap-0 flex flex-col",
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:left-0",
          "max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none",
          "max-sm:max-h-[min(94dvh,900px)] max-sm:w-full max-sm:max-w-none",
          "sm:max-w-lg sm:max-h-[min(92vh,820px)] sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]",
          "shadow-[0_0_0_1px_rgba(255,138,61,0.12),0_24px_64px_-24px_rgba(255,138,61,0.35)]",
          "max-sm:shadow-[0_-12px_48px_-12px_rgba(255,138,61,0.35)]",
        )}
      >
        <div
          aria-hidden
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#333] sm:hidden"
        />
        <div className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 border-b border-[#1f1f1f]">
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
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff8a3d]/15 blur-3xl"
          />

          <DialogHeader className="relative text-left space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#ff8a3d]/10 text-[#ff8a3d] border border-[#ff8a3d]/25 hover:bg-[#ff8a3d]/10">
                <Shield size={12} className="mr-1" />
                Trust Attestation
              </Badge>
              <Badge variant="outline" className="border-[#333] text-[#888] bg-transparent font-mono text-[10px]">
                Arc · 5042002
              </Badge>
            </div>

            <DialogTitle className="text-xl tracking-wide text-[#f5f5f5]">
              Stake a claim
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-[#666] leading-relaxed">
              Pick a target type, enter the subject, and put USDC behind your assertion on-chain.
            </DialogDescription>
          </DialogHeader>

          {resolvedTarget && (
            <div className="relative mt-4 rounded border border-[#1f1f1f] bg-[#111]/90 px-4 py-3 animate-fade-up">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#2a2a2a] bg-[#141414]">
                  <TargetIcon size={14} className={targetMeta.accent} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-[#666] font-mono">
                    {targetMeta.label}
                  </p>
                  <p className="mt-1 truncate font-mono text-sm text-[#f5f5f5]">
                    {formatTargetLabel(resolvedTarget)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {phase === "success" && txHash ? (
          <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-5 animate-fade-up pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#c8f135]/30 bg-[#c8f135]/10">
                <CheckCircle2 size={28} className="text-[#c8f135]" />
              </div>
              <div>
                <p className="text-lg font-medium tracking-wide text-[#f5f5f5]">Attestation live</p>
                <p className="mt-1 font-mono text-xs text-[#666]">
                  {stake} USDC staked on {formatTargetLabel(resolvedTarget)}
                </p>
              </div>
            </div>
            <div className="rounded border border-[#1f1f1f] bg-[#111] p-3">
              <p className="text-[10px] uppercase tracking-widest text-[#666] font-mono mb-1">Transaction</p>
              <p className="font-mono text-xs text-[#a3a3a3] break-all">{txHash}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-[#333]" onClick={handleClose}>
                Close
              </Button>
              <Button
                className="flex-1 bg-[#ff8a3d] text-[#0a0a0a] hover:bg-[#ff8a3d]/90"
                asChild
              >
                <a href={`${EXPLORER}${txHash}`} target="_blank" rel="noopener noreferrer">
                  View on Arcscan
                  <ExternalLink size={14} />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-5 animate-fade-up">
            <div className="space-y-3">
              <Label className="text-xs text-[#a3a3a3] font-mono uppercase tracking-wider">
                Target type
              </Label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-none sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
                {TARGET_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const selected = targetPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setTargetPreset(preset.id);
                        if (preset.id !== targetPreset) setTargetInput("");
                      }}
                      className={cn(
                        "shrink-0 snap-start rounded border px-3 py-3 sm:py-2.5 text-left transition-colors touch-manipulation min-w-[7.5rem] sm:min-w-0",
                        selected
                          ? "border-[#ff8a3d]/45 bg-[#ff8a3d]/10"
                          : "border-[#2a2a2a] bg-[#111] hover:border-[#444]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          size={14}
                          className={selected ? "text-[#ff8a3d]" : "text-[#888]"}
                        />
                        <span className="text-xs font-medium leading-tight">{preset.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="attest-target" className="text-xs text-[#a3a3a3] font-mono uppercase tracking-wider">
                  {activePresetMeta.label}
                </Label>
                <Input
                  id="attest-target"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder={activePresetMeta.placeholder}
                  disabled={busy}
                  className={cn(
                    "font-mono border-[#1f1f1f] bg-[#111] text-[#f5f5f5] focus-visible:ring-[#ff8a3d]/40",
                    targetInput.trim() && targetError && "border-destructive/50",
                  )}
                />
                <p className="font-mono text-[10px] text-[#555]">{activePresetMeta.hint}</p>
                {targetInput.trim() && targetError && (
                  <p className="font-mono text-[10px] text-destructive">{targetError}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attest-claim" className="text-xs text-[#a3a3a3] font-mono uppercase tracking-wider">
                Your claim
              </Label>
              <textarea
                id="attest-claim"
                className={cn(
                  "w-full min-h-[88px] sm:min-h-[96px] resize-y rounded border border-[#1f1f1f] bg-[#111] px-3 py-3",
                  "font-mono text-base sm:text-sm text-[#f5f5f5] placeholder:text-[#555]",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff8a3d]/50",
                  "disabled:opacity-50",
                )}
                placeholder="This source is reliable because…"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                disabled={busy}
                maxLength={500}
              />
              <p className="text-right font-mono text-[10px] text-[#555]">
                {claim.trim().length}/500 · min {MIN_CLAIM_CHARS} chars
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[#a3a3a3] font-mono uppercase tracking-wider">
                  Stake (USDC)
                </Label>
                <span className="font-mono text-[10px] text-[#666]">min {MIN_STAKE_USDC}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {STAKE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={busy}
                    onClick={() => setStake(preset)}
                    className={cn(
                      "rounded border px-3 py-1.5 font-mono text-xs transition-colors",
                      stake === preset
                        ? "border-[#ff8a3d]/50 bg-[#ff8a3d]/10 text-[#ff8a3d]"
                        : "border-[#2a2a2a] bg-[#111] text-[#888] hover:border-[#444] hover:text-[#ccc]",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                step="0.01"
                min={MIN_STAKE_USDC}
                value={Number.isNaN(stake) ? "" : stake}
                onChange={(e) => setStake(parseFloat(e.target.value))}
                disabled={busy}
                className="font-mono border-[#1f1f1f] bg-[#111] text-[#f5f5f5] focus-visible:ring-[#ff8a3d]/40"
              />
              <div className="rounded border border-[#1f1f1f] bg-[#111]/80 px-3 py-2.5 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-[#888]">
                  <span>Stake (locked on-chain)</span>
                  <span className="text-[#f5f5f5]">{stakeValid ? stake.toFixed(2) : "—"} USDC</span>
                </div>
                <div className="flex justify-between text-[#888]">
                  <span>Platform fee (attestations only)</span>
                  <span className="text-[#f5c842]">{ATTESTATION_PLATFORM_FEE_USDC} USDC</span>
                </div>
                <div className="flex justify-between border-t border-[#1f1f1f] pt-1.5 font-semibold text-[#f5f5f5]">
                  <span>Total charged</span>
                  <span>{stakeValid ? totalCostUsdc.toFixed(2) : "—"} USDC</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[#a3a3a3] font-mono uppercase tracking-wider">
                Sign with
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setWalletMode("agent");
                    void refreshAgentWallet();
                  }}
                  className={cn(
                    "relative rounded border px-3 py-3.5 sm:py-3 text-left transition-colors touch-manipulation min-h-[4rem]",
                    walletMode === "agent"
                      ? "border-[#f5c842]/55 bg-[#f5c842]/10 ring-1 ring-[#f5c842]/20"
                      : "border-[#2a2a2a] bg-[#111] hover:border-[#444]",
                  )}
                >
                  <Badge className="absolute -top-2 right-2 bg-[#f5c842]/15 text-[#f5c842] border border-[#f5c842]/30 hover:bg-[#f5c842]/15 text-[9px] px-1.5 py-0">
                    Default
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-[#f5c842]" />
                    <span className="text-sm font-medium">Agent wallet</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-[#666]">Circle Agent Stack</p>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setWalletMode("connected");
                    void refreshConnectedWallet();
                  }}
                  className={cn(
                    "rounded border px-3 py-3.5 sm:py-3 text-left transition-colors touch-manipulation min-h-[4rem]",
                    walletMode === "connected"
                      ? "border-[#ff8a3d]/40 bg-[#ff8a3d]/8"
                      : "border-[#2a2a2a] bg-[#111] hover:border-[#444]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Wallet size={14} className="text-[#ff8a3d]" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-[#666]">MetaMask / injected</p>
                </button>
              </div>

              {walletMode === "agent" && (
                <AgentWalletPanel
                  wallet={agentWallet}
                  loading={agentWalletLoading}
                  creating={creatingAgent}
                  busy={busy}
                  onRefresh={() => void refreshAgentWallet()}
                  onCreate={() => void handleCreateAgentWallet()}
                  minUsdc={totalCostUsdc}
                  showGatewayBalance
                  showWithdraw
                />
              )}

              {walletMode === "connected" && (
                <p className="font-mono text-[10px] text-[#666]">
                  {connectedAccount
                    ? `${connectedAccount.slice(0, 6)}…${connectedAccount.slice(-4)} · ${walletBalance ?? "—"} USDC`
                    : "Connect wallet when you attest"}
                </p>
              )}
            </div>

            {!contractAddress && (
              <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
                NEXT_PUBLIC_ATTESTATION_ADDRESS is not set.
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-[#1f1f1f] bg-[#0a0a0a] px-4 sm:px-6 py-3 sm:py-4 space-y-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {!canSubmit && submitBlockers.length > 0 && !busy && (
              <p className="font-mono text-[10px] text-[#888] leading-relaxed">
                {submitBlockers[0]}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 sm:h-10 border-[#333] text-[#ccc] hover:bg-[#141414] touch-manipulation"
                onClick={handleClose}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 sm:h-10 bg-[#ff8a3d] text-[#0a0a0a] hover:bg-[#ff8a3d]/90 disabled:bg-[#ff8a3d]/25 disabled:text-[#666] touch-manipulation"
                onClick={handleAttest}
                disabled={!canSubmit}
              >
                {busy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {phase === "approving" ? "Approving USDC…" : "Attesting…"}
                  </>
                ) : (
                  <>
                    <Shield size={14} />
                    Attest + Stake
                  </>
                )}
              </Button>
            </div>
          </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AttestModal;