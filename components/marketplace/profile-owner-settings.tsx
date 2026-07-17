"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Settings2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatorGatewayEarnings } from "@/components/marketplace/creator-gateway-earnings";
import { ProfileVerificationPanel } from "@/components/marketplace/profile-verification-panel";
import { UsernameSetupForm } from "@/components/marketplace/username-setup-form";
import {
  fetchProfile,
  savePayoutWallet,
  saveTipWallet,
  type ProfileStatus,
} from "@/lib/profile-client";
import { cacheMyPostsAuth } from "@/lib/my-posts-auth-cache";
import { myPostsHeaders, signMyPostsAuth } from "@/lib/publish-client";
import {
  getAuthorizedAccount,
  getEthereumProvider,
} from "@/lib/wallet-connection-client";

/**
 * Owner-only profile settings: the set-once identity controls that used to
 * live on the publish page. Username changes keep the existing rules (unique,
 * 7-day cooldown); payout changes require the publishing wallet's signature
 * and apply to future publishes and tips only.
 */
export function ProfileOwnerSettings({ className }: { className?: string }) {
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutInput, setPayoutInput] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [tipInput, setTipInput] = useState("");
  const [tipFormOpen, setTipFormOpen] = useState(false);
  const [savingTip, setSavingTip] = useState(false);
  /** Authorized wallet, read popup-free; the earnings withdraw needs it. */
  const [connected, setConnected] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProfile()
      .then(async (status) => {
        if (cancelled) return;
        setProfile(status);
        setPayoutInput(status.payoutWallet ?? "");
        setTipInput(status.tipWallet ?? "");
        setTipFormOpen(Boolean(status.tipWallet));
        const provider = await getEthereumProvider();
        const account = provider ? await getAuthorizedAccount(provider) : null;
        if (!cancelled) setConnected(account);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Shared signature step for payout and tip wallet changes. */
  const signSettingsAuth = useCallback(async () => {
    const provider = await getEthereumProvider();
    const account = provider ? await getAuthorizedAccount(provider) : null;
    if (!provider || !account) {
      throw new Error("Connect the wallet you publish with, then retry");
    }
    const auth = await signMyPostsAuth(provider, account);
    cacheMyPostsAuth(auth);
    return myPostsHeaders(auth);
  }, []);

  const changeTipWallet = useCallback(
    async (nextValue: string | null) => {
      setSavingTip(true);
      try {
        const headers = await signSettingsAuth();
        const saved = await saveTipWallet(nextValue, headers);
        setTipInput(saved ?? "");
        setTipFormOpen(Boolean(saved));
        setProfile((prev) => (prev ? { ...prev, tipWallet: saved } : prev));
        toast.success(saved ? "Tip wallet set" : "Tip override cleared", {
          description: saved
            ? "Tips now settle to this wallet."
            : "Tips settle to your payout wallet again.",
        });
      } catch (err) {
        if ((err as { code?: number }).code === 4001) {
          toast.message("Signature cancelled");
          return;
        }
        toast.error("Could not update tip wallet", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setSavingTip(false);
      }
    },
    [signSettingsAuth],
  );

  const changePayout = useCallback(async () => {
    const next = payoutInput.trim();
    if (!next) {
      toast.error("Enter the wallet that should receive payouts");
      return;
    }
    setSavingPayout(true);
    try {
      const headers = await signSettingsAuth();
      const saved = await savePayoutWallet(next, headers);
      setPayoutInput(saved);
      setProfile((prev) => (prev ? { ...prev, payoutWallet: saved } : prev));
      toast.success("Payout wallet updated", {
        description: "Future publishes and tips settle to this wallet.",
      });
    } catch (err) {
      if ((err as { code?: number }).code === 4001) {
        toast.message("Signature cancelled");
        return;
      }
      toast.error("Could not update payout wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingPayout(false);
    }
  }, [payoutInput, signSettingsAuth]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3 font-mono text-[10px] text-[#666]">
        <Loader2 size={12} className="animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4 rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-[#f5c842]" />
          <p className="text-sm font-semibold tracking-wide">Your settings</p>
          <span className="font-mono text-[10px] text-[#666]">only you see this</span>
        </div>

        <div className="space-y-2">
          <Label className="font-mono text-xs text-[#888]">Username</Label>
          <UsernameSetupForm
            profile={profile}
            submitLabel={profile?.hasProfile ? "Update username" : "Choose username"}
            onSaved={(saved) => setProfile(saved)}
          />
        </div>

        <div className="space-y-2 border-t border-[#1f1f1f] pt-3">
          <Label htmlFor="settings-payout" className="font-mono text-xs text-[#888]">
            Payout wallet
          </Label>
          <p className="font-mono text-[10px] leading-relaxed text-[#666]">
            Receives unlock revenue and tips for every future publish. Changing it
            requires a signature from the wallet you publish with. Already-published
            posts keep their original payout wallet.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="settings-payout"
              value={payoutInput}
              onChange={(e) => setPayoutInput(e.target.value)}
              placeholder="0x..."
              className="border-[#333] bg-[#111] font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              disabled={savingPayout}
              onClick={() => void changePayout()}
              className="shrink-0 border-[#333] font-mono text-xs"
            >
              {savingPayout ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Signing…
                </>
              ) : (
                <>
                  <Wallet size={12} />
                  Sign and save
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-[#1f1f1f] pt-3">
          <Label className="font-mono text-xs text-[#888]">Unlock earnings</Label>
          <CreatorGatewayEarnings
            connected={connected}
            payoutWalletInput={profile?.payoutWallet ?? ""}
          />
          {profile?.tipWallet && (
            <p className="font-mono text-[10px] text-[#666]">
              This panel reads your payout wallet. Tips settle separately to your tip
              wallet {profile.tipWallet.slice(0, 6)}…{profile.tipWallet.slice(-4)}.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-[#1f1f1f] pt-3">
          <Label className="font-mono text-xs text-[#888]">Tips</Label>
          {!tipFormOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] leading-relaxed text-[#666]">
                Tips go to your payout wallet.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={savingTip}
                onClick={() => setTipFormOpen(true)}
                className="h-7 border-[#333] font-mono text-[10px]"
              >
                Use a different wallet for tips
              </Button>
            </div>
          ) : (
            <>
              <p className="font-mono text-[10px] leading-relaxed text-[#666]">
                Tips settle to this wallet instead of the payout wallet. Clearing it
                reverts tips to the payout wallet. Changes require the same signature
                as payout changes.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={tipInput}
                  onChange={(e) => setTipInput(e.target.value)}
                  placeholder="0x..."
                  aria-label="Tip wallet"
                  className="border-[#333] bg-[#111] font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingTip || !tipInput.trim()}
                  onClick={() => void changeTipWallet(tipInput.trim())}
                  className="shrink-0 border-[#333] font-mono text-xs"
                >
                  {savingTip ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Signing…
                    </>
                  ) : (
                    <>
                      <Wallet size={12} />
                      Sign and save
                    </>
                  )}
                </Button>
                {profile?.tipWallet ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={savingTip}
                    onClick={() => void changeTipWallet(null)}
                    className="shrink-0 font-mono text-xs text-[#888]"
                  >
                    Clear override
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={savingTip}
                    onClick={() => {
                      setTipFormOpen(false);
                      setTipInput("");
                    }}
                    className="shrink-0 font-mono text-xs text-[#888]"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ProfileVerificationPanel className="mt-4" />
    </div>
  );
}
