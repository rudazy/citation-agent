"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/panel";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { UsernameSetupForm } from "@/components/marketplace/username-setup-form";
import { fetchProfile, savePayoutWallet, type ProfileStatus } from "@/lib/profile-client";
import { buildProfilePath } from "@/lib/profile-url";
import { cacheMyPostsAuth } from "@/lib/my-posts-auth-cache";
import { myPostsHeaders, signMyPostsAuth } from "@/lib/publish-client";
import {
  getAuthorizedAccount,
  getEthereumProvider,
} from "@/lib/wallet-connection-client";

/**
 * Compulsory account setup for the profile area. Visitors with a profile are
 * redirected to their settings; wallet-linked visitors without one walk
 * through connect wallet, choose username, one signature. On success the
 * profile exists, the payout wallet silently defaults to the signing wallet
 * (same rule as a first publish), and they land in their settings.
 * Reading and unlocking reports is never gated by this.
 */
export function ProfileSetupGate() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState<`0x${string}` | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = await fetchProfile();
      if (cancelled) return;
      if (status.username) {
        // Already set up: the profile area is the settings page.
        router.replace(buildProfilePath(status.username));
        return;
      }
      setProfile(status);
      // Detect an already-authorized wallet without opening any popup.
      const provider = await getEthereumProvider();
      const account = provider ? await getAuthorizedAccount(provider) : null;
      if (!cancelled) {
        setConnected(account);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /**
   * After the username is created: one signature sets the payout default to
   * the signing wallet. A rejected signature never blocks setup; the first
   * publish applies the same silent default later.
   */
  const finishSetup = useCallback(
    async (saved: ProfileStatus) => {
      setProfile(saved);
      if (!saved.username) return;
      setFinishing(true);
      try {
        if (connected && !saved.payoutWallet) {
          const provider = await getEthereumProvider();
          if (provider) {
            const auth = await signMyPostsAuth(provider, connected);
            cacheMyPostsAuth(auth);
            await savePayoutWallet(connected, myPostsHeaders(auth));
            toast.success("Account ready", {
              description: `Payout wallet set to ${connected.slice(0, 6)}…${connected.slice(-4)}`,
            });
          }
        }
      } catch (err) {
        if ((err as { code?: number }).code === 4001) {
          toast.message("Signature skipped", {
            description: "Your payout wallet will be set on your first publish.",
          });
        } else {
          toast.message("Payout wallet not set yet", {
            description: "It will default to your signing wallet on first publish.",
          });
        }
      } finally {
        setFinishing(false);
        router.push(buildProfilePath(saved.username));
      }
    },
    [connected, router],
  );

  if (checking) {
    return (
      <div className="mx-auto flex max-w-xl items-center gap-2 py-16 font-mono text-xs text-[#666]">
        <Loader2 size={14} className="animate-spin" />
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl w-full">
      <Panel glow className="space-y-5 p-5 sm:p-6 border-[#f5c842]/20">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserRound size={16} className="text-[#f5c842]" />
            <h1 className="text-lg font-semibold tracking-wide text-[#f5f5f5]">
              Set up an account
            </h1>
          </div>
          <p className="font-mono text-xs leading-relaxed text-[#888]">
            Claim identity to open your Creator Desk — publish research or a first
            Signal, share, and earn. Reading and unlocking works without an account.
          </p>
        </div>

        <div className="space-y-2 rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
            Step 1 · Wallet
          </p>
          {connected ? (
            <p className="font-mono text-xs text-[#c8f135]">
              Connected {connected.slice(0, 6)}…{connected.slice(-4)}
            </p>
          ) : (
            <>
              <p className="font-mono text-[10px] text-[#888] leading-relaxed">
                Connect the wallet you will publish with. It becomes your payout wallet.
              </p>
              <ConnectWalletButton
                label="Connect wallet"
                onConnected={(address) => setConnected(address)}
              />
            </>
          )}
        </div>

        <div className="space-y-2 rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
            Step 2 · Username
          </p>
          {connected ? (
            finishing ? (
              <p className="flex items-center gap-2 font-mono text-xs text-[#888]">
                <Loader2 size={12} className="animate-spin" />
                Finishing setup, approve the signature in your wallet…
              </p>
            ) : (
              <UsernameSetupForm
                publisherAddress={connected}
                profile={profile}
                submitLabel="Create account"
                onSaved={(saved) => void finishSetup(saved)}
              />
            )
          ) : (
            <p className="font-mono text-[10px] text-[#555]">
              Connect a wallet first to pick your username.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
