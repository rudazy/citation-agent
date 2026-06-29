"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GatewayWithdrawDialog } from "@/components/gateway/gateway-withdraw-dialog";
import {
  getRecoverableAgentWalletAddress,
  getRecoverableLinkedMetaMaskAddress,
  linkAgentWalletToMetaMask,
  pasteRecoveryWallet,
  recoverAgentWallet,
  restoreAgentWalletByMetaMask,
  type AgentWalletStatusResponse,
} from "@/lib/attestation-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { cn } from "@/lib/utils";
import "@/lib/ethereum-provider";

type AgentWalletPanelProps = {
  wallet: AgentWalletStatusResponse | null;
  loading: boolean;
  creating: boolean;
  busy?: boolean;
  onRefresh: () => void;
  onCreate: (recoveryWallet?: string) => void;
  onRecovered?: () => void;
  minUsdc?: number;
  showGatewayBalance?: boolean;
  showWithdraw?: boolean;
  /** Increment from parent to reset the setup wizard (e.g. re-tap Agent wallet). */
  setupResetKey?: number;
  onSetupActiveChange?: (active: boolean) => void;
};

type SetupStep = "landing" | "choose" | "recover" | "create";

function getEthereum(): EthereumProvider | undefined {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

const RECOVERY_WARNINGS = [
  "Paste carefully — a wrong address means you cannot recover on another device.",
  "Anyone can paste any public address; only that MetaMask holder can restore by signing.",
  "You can always create a new agent wallet if you do not want a recovered one.",
];

function StepHeader({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#666]">{label}</p>
      <span className="font-mono text-[10px] text-[#555]">
        {step}/{total}
      </span>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  icon,
  onClick,
  disabled,
  accent = "gold",
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: "gold" | "neutral";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded border px-3 py-3 text-left transition-colors touch-manipulation w-full",
        accent === "gold"
          ? "border-[#2a2a2a] bg-[#111] hover:border-[#f5c842]/40 hover:bg-[#f5c842]/5"
          : "border-[#2a2a2a] bg-[#111] hover:border-[#444] hover:bg-[#141414]",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded border",
            accent === "gold"
              ? "border-[#f5c842]/30 bg-[#f5c842]/10 text-[#f5c842]"
              : "border-[#333] bg-[#141414] text-[#a3a3a3]",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium tracking-wide text-[#f5f5f5]">{title}</p>
          <p className="font-mono text-[10px] text-[#666] leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function AgentWalletPanel({
  wallet,
  loading,
  creating,
  busy = false,
  onRefresh,
  onCreate,
  onRecovered,
  minUsdc,
  showGatewayBalance = false,
  showWithdraw = false,
  setupResetKey = 0,
  onSetupActiveChange,
}: AgentWalletPanelProps) {
  const [copied, setCopied] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("landing");
  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState(
    () => getRecoverableLinkedMetaMaskAddress() ?? "",
  );

  const recoverableAddress = getRecoverableAgentWalletAddress();
  const setupWizardActive = !!wallet?.canProvision && setupStep !== "landing";

  useEffect(() => {
    onSetupActiveChange?.(setupWizardActive || showAddRecovery);
  }, [setupWizardActive, showAddRecovery, onSetupActiveChange]);

  useEffect(() => {
    if (setupResetKey === 0) return;
    setSetupStep("landing");
    setShowAddRecovery(false);
  }, [setupResetKey]);

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

  const recoveryPasteBlock = (options?: { showWarnings?: boolean }) => (
    <div className="space-y-2">
      <label className="font-mono text-[10px] text-[#888]">
        Recovery MetaMask address
      </label>
      <Input
        value={recoveryInput}
        onChange={(e) => setRecoveryInput(e.target.value)}
        placeholder="0x… paste your MetaMask address"
        className="h-9 border-[#333] bg-[#0a0a0a] font-mono text-[11px] text-[#d4d4d4] placeholder:text-[#555]"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {options?.showWarnings !== false && (
        <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] px-2.5 py-2 space-y-1">
          {RECOVERY_WARNINGS.map((line) => (
            <p key={line} className="font-mono text-[10px] text-[#555] leading-relaxed">
              · {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );

  const handleRestoreByMetaMask = async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      toast.error("MetaMask not detected", {
        description: "Open this site in MetaMask browser or install the extension.",
      });
      return;
    }
    setRecovering(true);
    try {
      await restoreAgentWalletByMetaMask({
        ethereum,
        pastedMetaMaskAddress: recoveryInput.trim() || undefined,
      });
      toast.success("Agent wallet restored");
      setSetupStep("landing");
      onRecovered?.();
    } catch (err) {
      toast.error("Could not restore wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRecovering(false);
    }
  };

  const handlePasteRecovery = async () => {
    const value = recoveryInput.trim();
    if (!value) {
      toast.error("Paste your recovery MetaMask address first");
      return;
    }
    setPasting(true);
    try {
      await pasteRecoveryWallet(value);
      toast.success("Recovery address saved");
      setShowAddRecovery(false);
      onRecovered?.();
    } catch (err) {
      toast.error("Could not save recovery address", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setPasting(false);
    }
  };

  const handleVerifyWithMetaMask = async () => {
    if (!wallet?.address) return;
    const ethereum = getEthereum();
    if (!ethereum) {
      toast.error("MetaMask not detected");
      return;
    }
    setVerifying(true);
    try {
      await linkAgentWalletToMetaMask({
        agentAddress: wallet.address,
        ethereum,
        pastedMetaMaskAddress: recoveryInput.trim() || undefined,
      });
      toast.success("Recovery address verified");
      onRecovered?.();
    } catch (err) {
      toast.error("Verification failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRecoverByAgentAddress = async () => {
    if (!recoverableAddress) return;
    const ethereum = getEthereum();
    if (!ethereum) {
      toast.error("MetaMask not detected");
      return;
    }
    setRecovering(true);
    try {
      await recoverAgentWallet({ agentAddress: recoverableAddress, ethereum });
      toast.success("Agent wallet recovered");
      setSetupStep("landing");
      onRecovered?.();
    } catch (err) {
      toast.error("Could not recover wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRecovering(false);
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
            {wallet.label ?? "Your agent wallet"}
          </Badge>
          <button
            type="button"
            onClick={() => void copyAddress(wallet.address!)}
            className="inline-flex items-center gap-1.5 rounded border border-[#2a2a2a] bg-[#141414] px-2 py-1 font-mono text-[10px] text-[#a3a3a3] hover:border-[#f5c842]/35 hover:text-[#f5f5f5] transition-colors"
          >
            {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
            {copied ? <Check size={10} className="text-[#c8f135]" /> : <Copy size={10} />}
          </button>
          {wallet.linkedWallet && (
            <Badge variant="outline" className="border-[#333] font-mono text-[9px] text-[#888]">
              Recovery {wallet.linkedWallet.slice(0, 6)}…{wallet.linkedWallet.slice(-4)}
              {wallet.linkedWalletVerified ? " · verified" : " · pasted"}
            </Badge>
          )}
          <span className="font-mono text-[10px] text-[#666]">
            · {wallet.usdcBalance ?? "—"} USDC
            {showGatewayBalance ? ` · Gateway ${wallet.gatewayUsdc ?? "—"}` : ""}
          </span>
        </div>

        {!wallet.linkedWallet && !showAddRecovery && (
          <button
            type="button"
            onClick={() => setShowAddRecovery(true)}
            className="flex w-full items-center justify-between rounded border border-dashed border-[#f5c842]/25 bg-[#f5c842]/5 px-3 py-2 text-left transition-colors hover:border-[#f5c842]/40"
          >
            <span className="font-mono text-[10px] text-[#a3a3a3]">
              Add recovery address for other devices
            </span>
            <KeyRound size={12} className="text-[#f5c842]" />
          </button>
        )}

        {!wallet.linkedWallet && showAddRecovery && (
          <div className="rounded border border-[#f5c842]/20 bg-[#f5c842]/5 px-2.5 py-2.5 space-y-2">
            {recoveryPasteBlock()}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || pasting}
                onClick={() => void handlePasteRecovery()}
                className="h-8 border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10"
              >
                {pasting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save recovery address"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setShowAddRecovery(false)}
                className="font-mono text-[10px] text-[#666] hover:text-[#a3a3a3] px-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {wallet.linkedWallet && !wallet.linkedWalletVerified && (
          <button
            type="button"
            disabled={busy || verifying}
            onClick={() => void handleVerifyWithMetaMask()}
            className="font-mono text-[10px] text-[#666] hover:text-[#a3a3a3] disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Optional: verify recovery address with MetaMask"}
          </button>
        )}

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
          {showWithdraw && (
            <GatewayWithdrawDialog
              role="agent"
              maxAvailable={wallet.gateway?.available ?? wallet.gatewayUsdc ?? "0"}
              walletAddress={wallet.address}
              nativeGas={wallet.nativeGas}
              walletUsdc={wallet.usdcBalance}
              onSuccess={onRefresh}
            />
          )}
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
            Wallet funded. Deposit to Gateway before paying (Gateway: {wallet.gatewayUsdc ?? "0"}{" "}
            USDC).
          </p>
        )}
      </div>
    );
  }

  if (wallet?.canProvision) {
    if (setupStep === "landing") {
      return (
        <div className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-4 space-y-3 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
            <Bot size={18} className="text-[#f5c842]" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium tracking-wide text-[#f5f5f5]">No agent wallet yet</p>
            <p className="font-mono text-[10px] text-[#666] leading-relaxed max-w-sm mx-auto">
              Set up a wallet to pay from Circle Gateway without wallet popups on every unlock.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || creating}
            onClick={() => setSetupStep("choose")}
            className="h-9 border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10 px-5"
          >
            <Sparkles size={12} />
            Set up agent wallet
          </Button>
        </div>
      );
    }

    if (setupStep === "choose") {
      return (
        <div className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-3 space-y-3">
          <StepHeader step={1} total={2} label="Choose path" />
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard
              title="Recover wallet"
              description="You already created one on another device — connect MetaMask and sign."
              icon={<KeyRound size={14} />}
              onClick={() => setSetupStep("recover")}
              disabled={busy || creating}
              accent="gold"
            />
            <ChoiceCard
              title="Create new"
              description="First time here, or you want a fresh agent wallet on Arc."
              icon={<Bot size={14} />}
              onClick={() => setSetupStep("create")}
              disabled={busy || creating}
            />
          </div>
          <button
            type="button"
            onClick={() => setSetupStep("landing")}
            className="inline-flex items-center gap-1 font-mono text-[10px] text-[#666] hover:text-[#a3a3a3]"
          >
            <ArrowLeft size={10} />
            Back
          </button>
        </div>
      );
    }

    if (setupStep === "recover") {
      return (
        <div className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-3 space-y-3">
          <StepHeader step={2} total={2} label="Recover wallet" />
          <p className="font-mono text-[10px] text-[#888] leading-relaxed">
            Connect the same MetaMask address you pasted when you created your agent wallet. One
            signature restores your wallet and balances — no need to paste the address again.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || recovering || creating}
            onClick={() => void handleRestoreByMetaMask()}
            className="h-9 w-full border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10"
          >
            {recovering ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Restoring…
              </>
            ) : (
              "Connect MetaMask & restore"
            )}
          </Button>
          {recoverableAddress && (
            <button
              type="button"
              disabled={busy || recovering}
              onClick={() => void handleRecoverByAgentAddress()}
              className="block w-full text-center font-mono text-[10px] text-[#555] hover:text-[#888] disabled:opacity-50"
            >
              This browser only — recover {recoverableAddress.slice(0, 6)}…
              {recoverableAddress.slice(-4)}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSetupStep("choose")}
            className="inline-flex items-center gap-1 font-mono text-[10px] text-[#666] hover:text-[#a3a3a3]"
          >
            <ArrowLeft size={10} />
            Back
          </button>
        </div>
      );
    }

    return (
      <div className="rounded border border-[#1f1f1f] bg-[#111] px-3 py-3 space-y-3">
        <StepHeader step={2} total={2} label="Create new wallet" />
        <p className="font-mono text-[10px] text-[#888] leading-relaxed">
          Paste your main MetaMask address now — no connect needed on this device. You will use it
          later to restore on your phone or browser.
        </p>
        {recoveryPasteBlock()}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || creating}
          onClick={() => onCreate(recoveryInput.trim() || undefined)}
          className="h-9 w-full border-[#f5c842]/35 text-[#f5c842] hover:bg-[#f5c842]/10"
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
        <p className="font-mono text-[10px] text-[#555] text-center">
          Recovery address is optional but strongly recommended for Android installs.
        </p>
        <button
          type="button"
          onClick={() => setSetupStep("choose")}
          className="inline-flex items-center gap-1 font-mono text-[10px] text-[#666] hover:text-[#a3a3a3]"
        >
          <ArrowLeft size={10} />
          Back
        </button>
      </div>
    );
  }

  return (
    <p className="font-mono text-[10px] text-[#666]">
      Agent wallet unavailable. Ensure Supabase is configured, then create your wallet above.
    </p>
  );
}