"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Radio, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchToArcTestnet } from "@/lib/attestation-client";
import { MIN_POST_PRICE_USDC } from "@/lib/creator-post-constants";
import { PROFILE_SETUP_PATH } from "@/lib/profile-home";
import { fetchProfile, type ProfileStatus } from "@/lib/profile-client";
import { buildProfilePath } from "@/lib/profile-url";
import {
  publishHeaders,
  signPublishAuth,
} from "@/lib/publish-client";
import {
  buildSignalShareText,
  SIGNAL_DIRECTION_LABELS,
  SIGNAL_DIRECTIONS,
  SIGNAL_HORIZON_LABELS,
  SIGNAL_HORIZONS,
  type SignalDirection,
  type SignalHorizon,
} from "@/lib/signal-card";
import { copyPostShareLink } from "@/lib/post-share-url";
import { isWalletUiAvailable } from "@/lib/wallet-connection";
import {
  connectWalletInteractive,
  getEthereumProvider,
} from "@/lib/wallet-connection-client";
import { storeLinkedMetaMaskAddress } from "@/lib/agent-wallet-local";
import { cn } from "@/lib/utils";
import "@/lib/ethereum-provider";

type Props = {
  onPublished?: (postId?: string) => void;
  /** Start expanded (onboarding CTA). */
  defaultExpanded?: boolean;
};

/**
 * Compact Signal Card publisher — structured conviction without long-form editor.
 * Same signed POST /api/marketplace/citations path as research.
 */
export function SignalPublishPanel({
  onPublished,
  defaultExpanded = false,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [connected, setConnected] = useState<`0x${string}` | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [subheading, setSubheading] = useState("");
  const [thesis, setThesis] = useState("");
  const [direction, setDirection] = useState<SignalDirection>("watch");
  const [confidence, setConfidence] = useState("3");
  const [horizon, setHorizon] = useState<SignalHorizon>("90d");
  const [invalidation, setInvalidation] = useState("");
  const [priceUsdc, setPriceUsdc] = useState(String(MIN_POST_PRICE_USDC));
  const [lastShare, setLastShare] = useState<string | null>(null);

  useEffect(() => {
    setWalletAvailable(isWalletUiAvailable());
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      setProfile(await fetchProfile());
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) void refreshProfile();
  }, [expanded, refreshProfile]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { provider, address } = await connectWalletInteractive();
      setConnected(address);
      storeLinkedMetaMaskAddress(address);
      await switchToArcTestnet(provider).catch(() => undefined);
      await refreshProfile();
    } catch (err) {
      toast.error("Connect failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConnecting(false);
    }
  }, [refreshProfile]);

  const publish = useCallback(async () => {
    if (!profile?.username) {
      toast.error("Set up your desk first", {
        description: "Claim a username before publishing a signal.",
      });
      router.push(PROFILE_SETUP_PATH);
      return;
    }

    setPublishing(true);
    setPublishPhase("Preparing wallet…");
    try {
      const provider = await getEthereumProvider();
      if (!provider) throw new Error("Wallet not available");

      let account = connected;
      let eth = provider;
      if (!account) {
        const linked = await connectWalletInteractive();
        eth = linked.provider;
        account = linked.address;
        setConnected(account);
        storeLinkedMetaMaskAddress(account);
      }

      setPublishPhase("Sign the signal…");
      const payload = {
        title: title.trim(),
        subheading: subheading.trim(),
        body: thesis.trim(),
        priceUsdc: priceUsdc.trim(),
        tags: ["signal"],
        postKind: "signal" as const,
        signalDirection: direction,
        signalConfidence: Number(confidence),
        signalHorizon: horizon,
        signalInvalidation: invalidation.trim(),
      };

      const auth = await signPublishAuth(eth, account, payload);
      setPublishPhase("Publishing…");
      const res = await fetch("/api/marketplace/citations", {
        method: "POST",
        headers: publishHeaders(auth),
        body: JSON.stringify({
          title: payload.title,
          subheading: payload.subheading,
          body: payload.body,
          price_usdc: payload.priceUsdc,
          tags: payload.tags,
          post_kind: "signal",
          signal_direction: payload.signalDirection,
          signal_confidence: payload.signalConfidence,
          signal_horizon: payload.signalHorizon,
          signal_invalidation: payload.signalInvalidation,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        post?: { id: string; author?: string };
      };
      if (!res.ok) throw new Error(data.error ?? `Publish failed (${res.status})`);

      const postId = data.post?.id;
      toast.success("Signal published", {
        description: postId ? `Live at /r/${postId}` : "Your desk is updated.",
      });

      if (postId && profile.username) {
        try {
          const url = await copyPostShareLink(postId);
          const share = buildSignalShareText({
            title: payload.title,
            username: profile.username,
            direction,
            confidence: Number(confidence),
            horizon,
            url,
          });
          setLastShare(share);
          await navigator.clipboard.writeText(share);
          toast.message("Share kit copied", {
            description: "Paste into X or a YouTube description.",
          });
        } catch {
          // Share kit is best-effort.
        }
      }

      setTitle("");
      setSubheading("");
      setThesis("");
      setInvalidation("");
      setPriceUsdc(String(MIN_POST_PRICE_USDC));
      onPublished?.(postId);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4001) {
        toast.message("Signature rejected");
      } else {
        toast.error("Could not publish signal", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    } finally {
      setPublishing(false);
      setPublishPhase(null);
    }
  }, [
    confidence,
    connected,
    direction,
    horizon,
    invalidation,
    onPublished,
    priceUsdc,
    profile,
    router,
    subheading,
    thesis,
    title,
  ]);

  return (
    <Panel className="space-y-0 overflow-hidden border-[#1f1f1f] p-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#111]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Radio size={16} className="shrink-0 text-[#c8f135]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Publish a Signal
            </p>
            <p className="font-mono text-[10px] text-[#666]">
              Structured conviction · unlockable · no full report required
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-[#666] transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[#1f1f1f] px-4 py-4">
          <p className="font-mono text-[11px] leading-relaxed text-[#888]">
            Five-minute path: claim a desk → one signal → share. Buyers unlock the
            thesis; direction, confidence, horizon, and invalidation stay public.
          </p>

          {!profile?.username && !profileLoading && (
            <div className="rounded border border-[#f5c842]/25 bg-[#f5c842]/5 px-3 py-2.5">
              <p className="font-mono text-[11px] text-[#c8b06a]">
                Open a Desk first —{" "}
                <Link
                  href={PROFILE_SETUP_PATH}
                  className="text-[#f5c842] underline-offset-2 hover:underline"
                >
                  claim identity
                </Link>
              </p>
            </div>
          )}

          {profile?.username && (
            <p className="font-mono text-[11px] text-[#888]">
              Publishing to desk{" "}
              <Link
                href={buildProfilePath(profile.username)}
                className="text-[#f5c842] hover:underline"
              >
                @{profile.username}
              </Link>
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="font-mono text-xs text-[#888]">Thesis title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ETH rotates into L2s through Q3"
                className="border-[#333] bg-[#0a0a0a] font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="font-mono text-xs text-[#888]">
                Public teaser (shown before unlock)
              </Label>
              <Input
                value={subheading}
                onChange={(e) => setSubheading(e.target.value)}
                placeholder="Why this matters in one or two sentences"
                className="border-[#333] bg-[#0a0a0a] font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs text-[#888]">Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as SignalDirection)}
              >
                <SelectTrigger className="border-[#333] bg-[#0a0a0a] font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNAL_DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d} className="font-mono text-xs">
                      {SIGNAL_DIRECTION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs text-[#888]">
                Confidence (1–5)
              </Label>
              <Select value={confidence} onValueChange={setConfidence}>
                <SelectTrigger className="border-[#333] bg-[#0a0a0a] font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4", "5"].map((n) => (
                    <SelectItem key={n} value={n} className="font-mono text-xs">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs text-[#888]">Horizon</Label>
              <Select
                value={horizon}
                onValueChange={(v) => setHorizon(v as SignalHorizon)}
              >
                <SelectTrigger className="border-[#333] bg-[#0a0a0a] font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNAL_HORIZONS.map((h) => (
                    <SelectItem key={h} value={h} className="font-mono text-xs">
                      {SIGNAL_HORIZON_LABELS[h]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs text-[#888]">
                Price (USDC)
              </Label>
              <Input
                value={priceUsdc}
                onChange={(e) => setPriceUsdc(e.target.value)}
                className="border-[#333] bg-[#0a0a0a] font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="font-mono text-xs text-[#888]">
                Invalidation (public)
              </Label>
              <Input
                value={invalidation}
                onChange={(e) => setInvalidation(e.target.value)}
                placeholder="What would prove this wrong?"
                className="border-[#333] bg-[#0a0a0a] font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="font-mono text-xs text-[#888]">
                Full thesis (unlocked after pay)
              </Label>
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                rows={4}
                placeholder="Evidence, levels, catalysts — the paid judgment."
                className="w-full resize-y rounded border border-[#333] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#f5f5f5] placeholder:text-[#555] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!connected && walletAvailable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={connecting}
                onClick={() => void connect()}
                className="border-[#333] font-mono text-xs"
              >
                {connecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Connect wallet"
                )}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={publishing}
              onClick={() => void publish()}
              className="gap-1.5 border border-[#c8f135]/40 bg-[#c8f135]/10 font-mono text-xs text-[#c8f135] hover:bg-[#c8f135]/15"
            >
              {publishing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {publishPhase ?? "Publishing…"}
                </>
              ) : (
                "Sign and publish signal"
              )}
            </Button>
          </div>

          {lastShare && (
            <div className="space-y-2 rounded border border-[#1f1f1f] bg-[#111]/80 px-3 py-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[#666]">
                <Share2 size={12} className="text-[#f5c842]" />
                Share kit (X / YouTube description)
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#aaa]">
                {lastShare}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 font-mono text-[10px] text-[#f5c842]"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(lastShare);
                    toast.success("Copied again");
                  } catch {
                    toast.error("Clipboard unavailable");
                  }
                }}
              >
                Copy again
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
