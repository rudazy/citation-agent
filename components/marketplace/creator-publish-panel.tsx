"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, PenLine, Wallet } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { switchToArcTestnet } from "@/lib/attestation-client";
import { isWalletUiAvailable } from "@/lib/wallet-connection";
import {
  connectWalletInteractive,
  getEthereumProvider,
} from "@/lib/wallet-connection-client";
import { ArticleBodyEditor } from "@/components/marketplace/article-body-editor";
import { PROFILE_SETUP_PATH } from "@/lib/profile-home";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultTagsInput, needsUsernameSetup } from "@/lib/publish-form-setup";
import {
  resolveSchedulePreset,
  SCHEDULE_PRESET_OPTIONS,
  type SchedulePreset,
} from "@/lib/publish-schedule";
import { PublisherPostsDropdown } from "@/components/marketplace/publisher-posts-dropdown";
import {
  TrustSignalBadge,
  type PublicTrustSignal,
} from "@/components/marketplace/trust-signal";
import { buildPostSharePath, copyPostShareLink } from "@/lib/post-share-url";
import { buildProfilePath } from "@/lib/profile-url";
import { fetchProfile, type ProfileStatus } from "@/lib/profile-client";
import {
  myPostsHeaders,
  publishHeaders,
  signMyPostsAuth,
  signPublishAuth,
} from "@/lib/publish-client";
import {
  cacheMyPostsAuth,
  getCachedMyPostsCatalogHeaders,
} from "@/lib/my-posts-auth-cache";
import {
  clearLocalDraft,
  loadLocalDraft,
  localDraftHasContent,
  saveLocalDraft,
} from "@/lib/draft-local";
import { storeLinkedMetaMaskAddress } from "@/lib/agent-wallet-local";
import { MIN_POST_PRICE_USDC } from "@/lib/creator-post-constants";
import { parseImportPaste } from "@/lib/import-paste";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import "@/lib/ethereum-provider";

type Props = {
  onPublished?: (postId?: string) => void;
};

export function CreatorPublishPanel({ onPublished }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [articleExpanded, setArticleExpanded] = useState(false);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [connected, setConnected] = useState<`0x${string}` | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  /** Short status while the multi-step publish flow runs (wallet + network). */
  const [publishPhase, setPublishPhase] = useState<string | null>(null);
  const [myPostsRefresh, setMyPostsRefresh] = useState(0);
  const [walletTrust, setWalletTrust] = useState<PublicTrustSignal | null>(null);
  const [walletTrustLoading, setWalletTrustLoading] = useState(false);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(null);
  const [importPaste, setImportPaste] = useState("");
  const localHydratedRef = useRef<string | null>(null);

  const [title, setTitle] = useState("");
  const [subheading, setSubheading] = useState("");
  const [body, setBody] = useState("");
  const [priceUsdc, setPriceUsdc] = useState(String(MIN_POST_PRICE_USDC));
  const [tags, setTags] = useState(defaultTagsInput());
  const [coverImageUrl, setCoverImageUrl] = useState("");
  /** Dropdown preset; "custom" reveals the datetime picker below. */
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>("now");
  /** datetime-local value used only when schedulePreset is "custom". */
  const [scheduledFor, setScheduledFor] = useState("");
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setWalletAvailable(isWalletUiAvailable());
  }, []);

  // Restore browser draft when wallet connects (once per wallet).
  useEffect(() => {
    if (!connected) return;
    if (localHydratedRef.current === connected.toLowerCase()) return;
    localHydratedRef.current = connected.toLowerCase();
    const local = loadLocalDraft(connected);
    if (!localDraftHasContent(local) || !local) return;
    setTitle(local.title);
    setSubheading(local.subheading);
    setBody(local.body);
    if (local.priceUsdc) setPriceUsdc(local.priceUsdc);
    setTags(local.tags);
    setServerDraftId(local.serverDraftId ?? null);
    setLocalSavedAt(local.updatedAt);
    setArticleExpanded(true);
    setExpanded(true);
    toast.message("Draft restored", {
      description: "Local autosave loaded for this wallet.",
    });
  }, [connected]);

  // Local autosave (no wallet signature).
  useEffect(() => {
    if (!connected) return;
    const timer = window.setTimeout(() => {
      const saved = saveLocalDraft(connected, {
        title,
        subheading,
        body,
        priceUsdc,
        // Payout is a profile setting now; drafts keep the field for shape compatibility.
        payoutWallet: "",
        tags,
        serverDraftId,
      });
      setLocalSavedAt(saved.updatedAt);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [connected, title, subheading, body, priceUsdc, tags, serverDraftId]);

  useEffect(() => {
    if (!connected) {
      setWalletTrust(null);
      return;
    }
    let cancelled = false;
    setWalletTrustLoading(true);
    void fetch(`/api/trustgate/wallet-score?address=${connected}`)
      .then((res) => res.json())
      .then((data: { trust?: PublicTrustSignal | null }) => {
        if (!cancelled) setWalletTrust(data.trust ?? null);
      })
      .catch(() => {
        if (!cancelled) setWalletTrust(null);
      })
      .finally(() => {
        if (!cancelled) setWalletTrustLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    void fetchProfile(connected)
      .then((status) => {
        if (!cancelled) setProfile(status);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, myPostsRefresh]);

  const connectWallet = useCallback(async () => {
    if (!isWalletUiAvailable()) {
      toast.error("Wallet unavailable", {
        description: "Use WalletConnect on mobile or install MetaMask.",
      });
      return;
    }
    setConnecting(true);
    try {
      const { provider, address } = await connectWalletInteractive();
      setConnected(address);
      storeLinkedMetaMaskAddress(address);
      setExpanded(true);
      toast.success("Wallet connected", {
        description: `${address.slice(0, 6)}...${address.slice(-4)}`,
      });
    } catch (err) {
      toast.error("Could not connect wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConnecting(false);
    }
  }, []);

  const ensureMyPostsAuth = useCallback(
    async (
      provider: EthereumProvider,
      account: `0x${string}`,
    ): Promise<Record<string, string>> => {
      const cached = getCachedMyPostsCatalogHeaders(account);
      if (Object.keys(cached).length > 0) return cached;
      const auth = await signMyPostsAuth(provider, account);
      cacheMyPostsAuth(auth);
      return myPostsHeaders(auth);
    },
    [],
  );

  const saveDraft = useCallback(async () => {
    if (!isWalletUiAvailable()) {
      toast.error("Wallet unavailable", {
        description: "Use WalletConnect on mobile or install MetaMask.",
      });
      return;
    }
    if (!profile?.username) {
      toast.error("Username required", {
        description: "Choose a unique username before saving a server draft.",
      });
      return;
    }

    setSavingDraft(true);
    try {
      let provider: EthereumProvider;
      let account: `0x${string}`;
      if (connected) {
        const active = await getEthereumProvider();
        if (!active) throw new Error("Connect your wallet first.");
        provider = active;
        account = connected;
        await switchToArcTestnet(provider);
      } else {
        const linked = await connectWalletInteractive();
        provider = linked.provider;
        account = linked.address;
        setConnected(account);
        storeLinkedMetaMaskAddress(account);
      }

      const authHeaders = await ensureMyPostsAuth(provider, account);
      const res = await fetch("/api/marketplace/drafts", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: serverDraftId ?? undefined,
          title,
          subheading,
          body,
          price_usdc: priceUsdc,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        draft?: { id: string; updated_at: string };
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Save draft failed (${res.status})`);
      }
      const draftId = data.draft?.id ?? null;
      setServerDraftId(draftId);
      saveLocalDraft(account, {
        title,
        subheading,
        body,
        priceUsdc,
        payoutWallet: "",
        tags,
        serverDraftId: draftId,
      });
      toast.success("Draft saved", {
        description: "Stored on the server. Sign and publish when ready.",
      });
    } catch (err) {
      if ((err as { code?: number }).code === 4001) {
        toast.message("Signature cancelled");
        return;
      }
      toast.error("Could not save draft", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingDraft(false);
    }
  }, [
    body,
    connected,
    ensureMyPostsAuth,
    priceUsdc,
    profile?.username,
    serverDraftId,
    subheading,
    tags,
    title,
  ]);

  const publish = useCallback(async () => {
    if (!isWalletUiAvailable()) {
      toast.error("Wallet unavailable", {
        description: "Use WalletConnect on mobile or install MetaMask.",
      });
      return;
    }

    if (!profile?.username) {
      toast.error("Username required", {
        description: "Choose a unique username before publishing.",
      });
      return;
    }

    setPublishing(true);
    setPublishPhase("Preparing…");
    try {
      let provider: EthereumProvider;
      let account: `0x${string}`;

      if (connected) {
        const active = await getEthereumProvider();
        if (!active) throw new Error("Connect your wallet first.");
        provider = active;
        account = connected;
        setPublishPhase("Switching network…");
        await switchToArcTestnet(provider);
      } else {
        setPublishPhase("Connecting wallet…");
        const linked = await connectWalletInteractive();
        provider = linked.provider;
        account = linked.address;
        setConnected(account);
        storeLinkedMetaMaskAddress(account);
      }

      const publishPayload = {
        title,
        subheading,
        body,
        priceUsdc,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        coverImageUrl: coverImageUrl.trim() || undefined,
      };

      // Delivery time is not signed content; validate it before asking for a signature.
      let scheduledForIso: string | undefined;
      const presetDate = resolveSchedulePreset(schedulePreset);
      if (presetDate) {
        scheduledForIso = presetDate.toISOString();
      } else if (schedulePreset === "custom") {
        if (!scheduledFor.trim()) {
          throw new Error("Pick a custom publish time or switch back to Publish now");
        }
        const scheduledMs = new Date(scheduledFor).getTime();
        if (!Number.isFinite(scheduledMs)) throw new Error("Invalid scheduled time");
        if (scheduledMs <= Date.now()) {
          throw new Error("Scheduled time must be in the future");
        }
        scheduledForIso = new Date(scheduledMs).toISOString();
      }

      // One wallet signature is enough to publish. Do not block on my-posts auth.
      setPublishPhase("Approve signature in wallet…");
      const auth = await signPublishAuth(provider, account, publishPayload);

      setPublishPhase("Uploading post…");
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 90_000);
      let res: Response;
      try {
        // If we have a server draft, publish by converting it when body matches via normal insert
        // (fresh published post). Draft row is cleaned up after successful publish.
        res = await fetch("/api/marketplace/citations", {
          method: "POST",
          headers: publishHeaders(auth),
          signal: controller.signal,
          body: JSON.stringify({
            title: publishPayload.title,
            subheading: publishPayload.subheading,
            body: publishPayload.body,
            price_usdc: publishPayload.priceUsdc,
            tags: publishPayload.tags,
            cover_image_url: publishPayload.coverImageUrl,
            scheduled_for: scheduledForIso,
          }),
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Publish timed out after 90s — check network and try again");
        }
        throw err;
      } finally {
        window.clearTimeout(timeoutId);
      }

      let data: { error?: string; post?: { id: string } } = {};
      try {
        data = (await res.json()) as { error?: string; post?: { id: string } };
      } catch {
        throw new Error(
          res.ok
            ? "Publish succeeded but response was unreadable"
            : `Publish failed (${res.status}) — empty or invalid server response`,
        );
      }
      if (!res.ok) {
        throw new Error(data.error ?? `Publish failed (${res.status})`);
      }

      const postId = data.post?.id;

      // Optional second signature for "my posts" list — never blocks publish success.
      setPublishPhase("Caching publisher session…");
      try {
        const myPostsAuth = await signMyPostsAuth(provider, account);
        cacheMyPostsAuth(myPostsAuth);
        // Best-effort: drop server draft after successful publish.
        if (serverDraftId) {
          void fetch(
            `/api/marketplace/drafts?id=${encodeURIComponent(serverDraftId)}`,
            {
              method: "DELETE",
              headers: myPostsHeaders(myPostsAuth),
            },
          );
        }
      } catch {
        // Catalog can prompt for my-posts auth later.
      }

      if (postId) {
        try {
          const shareUrl = await copyPostShareLink(postId);
          toast.success("Post published — link copied", {
            description: shareUrl,
          });
        } catch {
          toast.success("Post published", { description: postId });
        }
        router.replace(buildPostSharePath(postId));
      } else {
        toast.success("Post published", {
          description: "Saved to marketplace",
        });
      }

      clearLocalDraft(account);
      setServerDraftId(null);
      setLocalSavedAt(null);
      setTitle("");
      setSubheading("");
      setBody("");
      setPriceUsdc(String(MIN_POST_PRICE_USDC));
      setTags(defaultTagsInput());
      setCoverImageUrl("");
      setSchedulePreset("now");
      setScheduledFor("");
      setArticleExpanded(false);
      // setMyPostsRefresh below re-fetches the profile, so a first-time payout
      // save hides the payout field on the next publish.
      setMyPostsRefresh((n) => n + 1);
      onPublished?.(postId);
    } catch (err) {
      if ((err as { code?: number }).code === 4001) {
        toast.message("Signature cancelled");
        return;
      }
      toast.error("Publish failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setPublishing(false);
      setPublishPhase(null);
    }
  }, [
    body,
    profile?.username,
    connected,
    coverImageUrl,
    onPublished,
    router,
    priceUsdc,
    schedulePreset,
    scheduledFor,
    serverDraftId,
    subheading,
    tags,
    title,
  ]);

  const shortAddress = connected
    ? `${connected.slice(0, 6)}...${connected.slice(-4)}`
    : null;

  return (
    <Panel
      id="publish-research"
      glow
      className="space-y-4 p-4 sm:p-5 border-[#f5c842]/20 scroll-mt-24"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#f5c842]/30 bg-[#f5c842]/10">
          <PenLine size={18} className="text-[#f5c842]" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold tracking-wide">Publish research</h2>
          <p className="font-mono text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {expanded
              ? connected
                ? profile?.displayName
                  ? `Publishing as ${profile.displayName} — draft anytime, sign when ready.`
                  : `Wallet ${shortAddress} — choose a username to draft or publish.`
                : "Connect wallet to draft, publish, and view your listings."
              : "Creators — draft offline, save to server, sign once to go live."}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "mt-1 shrink-0 text-[#888] transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[#1f1f1f] pt-4">
          {!walletAvailable && (
            <p className="rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-xs text-[#888]">
              Install MetaMask or another injected wallet to publish.
            </p>
          )}

          {walletAvailable && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={connecting}
                onClick={() => void connectWallet()}
                className="gap-1.5 border-[#333] font-mono text-xs"
              >
                {connecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Wallet size={14} />
                )}
                {shortAddress ? `Connected ${shortAddress}` : "Connect wallet"}
              </Button>
              {connected && (
                <>
                  {walletTrustLoading ? (
                    <span className="font-mono text-[10px] text-[#666]">Loading score…</span>
                  ) : (
                    <TrustSignalBadge
                      trust={walletTrust}
                      className="border-[#f5c842]/25 text-[#f5c842]"
                    />
                  )}
                  <PublisherPostsDropdown
                    connected={connected}
                    walletTrust={walletTrust}
                    walletTrustLoading={walletTrustLoading}
                    refreshKey={myPostsRefresh}
                  />
                </>
              )}
              {shortAddress && (
                <span className="font-mono text-[10px] text-[#666]">
                  Signature required on publish
                </span>
              )}
            </div>
          )}

          <div className="rounded border border-[#1f1f1f] bg-[#111]/60">
            <button
              type="button"
              onClick={() => setArticleExpanded((v) => !v)}
              aria-expanded={articleExpanded}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
            >
              <span className="text-sm font-semibold tracking-wide">Article details</span>
              <ChevronDown
                size={16}
                className={cn(
                  "shrink-0 text-[#888] transition-transform",
                  articleExpanded && "rotate-180",
                )}
              />
            </button>

            {articleExpanded && (
              <div className="grid gap-4 border-t border-[#1f1f1f] px-3 py-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2 rounded border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-3">
                  <Label htmlFor="import-paste" className="font-mono text-xs text-[#888]">
                    Import paste (optional)
                  </Label>
                  <textarea
                    id="import-paste"
                    value={importPaste}
                    onChange={(e) => setImportPaste(e.target.value)}
                    rows={3}
                    placeholder="Paste markdown from your notes / Substack draft. First heading → title, first paragraph → teaser."
                    className={cn(
                      "w-full rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-xs text-[#f5f5f5]",
                      "placeholder:text-[#555] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
                    )}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!importPaste.trim()}
                    onClick={() => {
                      const parsed = parseImportPaste(importPaste);
                      if (parsed.title) setTitle(parsed.title);
                      if (parsed.subheading) setSubheading(parsed.subheading);
                      if (parsed.body) setBody(parsed.body);
                      setImportPaste("");
                      toast.success("Import applied", {
                        description: "Review fields, save draft, then sign to publish.",
                      });
                    }}
                    className="border-[#333] font-mono text-[10px]"
                  >
                    Apply import
                  </Button>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publish-title" className="font-mono text-xs text-[#888]">
                    Title
                  </Label>
                  <Input
                    id="publish-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Berachain liquidity analysis"
                    className="border-[#333] bg-[#111] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publish-subheading" className="font-mono text-xs text-[#888]">
                    Subheading (public teaser)
                  </Label>
                  <textarea
                    id="publish-subheading"
                    value={subheading}
                    onChange={(e) => setSubheading(e.target.value)}
                    rows={2}
                    placeholder="Public teaser — what buyers see before they pay"
                    className={cn(
                      "w-full rounded border border-[#333] bg-[#111] px-3 py-2 font-mono text-sm text-[#f5f5f5]",
                      "placeholder:text-[#555] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f5c842]/40",
                    )}
                  />
                </div>

                <ArticleBodyEditor
                  id="publish-body"
                  value={body}
                  onChange={setBody}
                  connected={connected}
                  disabled={publishing}
                />

                <div className="space-y-2">
                  <Label htmlFor="publish-price" className="font-mono text-xs text-[#888]">
                    Price (USDC)
                  </Label>
                  <Input
                    id="publish-price"
                    type="text"
                    inputMode="decimal"
                    value={priceUsdc}
                    onChange={(e) => setPriceUsdc(e.target.value)}
                    placeholder={String(MIN_POST_PRICE_USDC)}
                    className="border-[#333] bg-[#111] font-mono text-sm"
                  />
                </div>


                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publish-tags" className="font-mono text-xs text-[#888]">
                    Tags (comma-separated)
                  </Label>
                  <Input
                    id="publish-tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="defi, onchain, sui, research"
                    className="border-[#333] bg-[#111] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publish-cover" className="font-mono text-xs text-[#888]">
                    Cover image URL (optional)
                  </Label>
                  <Input
                    id="publish-cover"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="https://… shown on catalog cards and shared links"
                    className="border-[#333] bg-[#111] font-mono text-sm"
                  />
                  <p className="font-mono text-[10px] text-[#666]">
                    Tip: paste an image into the article body first, then reuse its URL here.
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publish-schedule" className="font-mono text-xs text-[#888]">
                    Schedule
                  </Label>
                  <Select
                    value={schedulePreset}
                    onValueChange={(value) => setSchedulePreset(value as SchedulePreset)}
                  >
                    <SelectTrigger
                      id="publish-schedule"
                      className="w-full border-[#333] bg-[#111] font-mono text-sm"
                    >
                      <SelectValue placeholder="Publish now" />
                    </SelectTrigger>
                    <SelectContent className="border-[#333] bg-[#111] font-mono text-sm">
                      {SCHEDULE_PRESET_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {schedulePreset === "custom" && (
                    <Input
                      type="datetime-local"
                      aria-label="Custom publish time"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="border-[#333] bg-[#111] font-mono text-sm"
                    />
                  )}
                  {schedulePreset !== "now" && (
                    <p className="font-mono text-[10px] text-[#666]">
                      Scheduled posts stay hidden until the chosen time.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {connected && needsUsernameSetup(profile) && !profileLoading && (
            <p className="font-mono text-[10px] text-[#666]">
              <Link
                href={PROFILE_SETUP_PATH}
                className="text-[#f5c842] hover:underline"
              >
                Set up your account
              </Link>
              {" to publish. Reading and unlocking research needs no account."}
            </p>
          )}

          {connected && !needsUsernameSetup(profile) && profile?.username && (
            <p className="font-mono text-[10px] text-[#666]">
              Publishing as{" "}
              <Link
                href={buildProfilePath(profile.username)}
                className="text-[#f5c842] hover:underline"
              >
                {profile.displayName ?? profile.username}
              </Link>
              {" · manage username, payout wallet, verification, and earnings on your "}
              <Link
                href={buildProfilePath(profile.username)}
                className="text-[#f5c842] hover:underline"
              >
                profile
              </Link>
            </p>
          )}

          {(localSavedAt || serverDraftId) && (
            <p className="font-mono text-[10px] text-[#666]">
              {serverDraftId
                ? `Server draft ${serverDraftId.slice(0, 24)}…`
                : "Local autosave only"}
              {localSavedAt
                ? ` · last local save ${new Date(localSavedAt).toLocaleTimeString()}`
                : ""}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={
                !walletAvailable ||
                !connected ||
                publishing ||
                savingDraft ||
                !profile?.username
              }
              onClick={() => void saveDraft()}
              className="w-full sm:w-auto border-[#333] font-mono text-xs tracking-wide"
            >
              {savingDraft ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Saving draft…
                </>
              ) : (
                "Save draft"
              )}
            </Button>
            <Button
              type="button"
              disabled={
                !walletAvailable ||
                !connected ||
                publishing ||
                savingDraft ||
                !profile?.username
              }
              onClick={() => void publish()}
              className="w-full sm:w-auto border border-[#f5c842]/40 bg-[#f5c842]/10 text-[#f5c842] hover:bg-[#f5c842]/20 font-mono text-xs tracking-wide"
            >
              {publishing ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  {publishPhase ?? "Publishing…"}
                </>
              ) : (
                "Sign and publish"
              )}
            </Button>
          </div>
          <p className="font-mono text-[10px] text-[#555] leading-relaxed">
            Local autosave runs while you type. Save draft stores a server copy (one
            wallet signature, reusable briefly). Publish still requires a payload signature.
          </p>
        </div>
      )}
    </Panel>
  );
}