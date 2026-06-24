"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, PenLine, Wallet } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getConnectedAccount,
  switchToArcTestnet,
} from "@/lib/attestation-client";
import { ArticleBodyEditor } from "@/components/marketplace/article-body-editor";
import { publishHeaders, signPublishAuth } from "@/lib/publish-client";
import { MIN_POST_PRICE_USDC } from "@/lib/creator-post-constants";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import "@/lib/ethereum-provider";

type Props = {
  onPublished?: () => void;
};

export function CreatorPublishPanel({ onPublished }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [articleExpanded, setArticleExpanded] = useState(false);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [connected, setConnected] = useState<`0x${string}` | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [title, setTitle] = useState("");
  const [subheading, setSubheading] = useState("");
  const [body, setBody] = useState("");
  const [priceUsdc, setPriceUsdc] = useState(String(MIN_POST_PRICE_USDC));
  const [payoutWallet, setPayoutWallet] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    setWalletAvailable(typeof window !== "undefined" && Boolean(window.ethereum));
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum) {
      toast.error("Wallet not detected");
      return;
    }
    setConnecting(true);
    try {
      await switchToArcTestnet(ethereum);
      const account = await getConnectedAccount(ethereum);
      setConnected(account);
      toast.success("Wallet connected", {
        description: `${account.slice(0, 6)}...${account.slice(-4)}`,
      });
    } catch (err) {
      toast.error("Could not connect wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConnecting(false);
    }
  }, []);

  const publish = useCallback(async () => {
    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum) {
      toast.error("Wallet not detected");
      return;
    }

    setPublishing(true);
    try {
      await switchToArcTestnet(ethereum);
      const account = connected ?? (await getConnectedAccount(ethereum));
      setConnected(account);

      const auth = await signPublishAuth(ethereum, account);
      const res = await fetch("/api/marketplace/citations", {
        method: "POST",
        headers: publishHeaders(auth),
        body: JSON.stringify({
          title,
          subheading,
          body,
          price_usdc: priceUsdc,
          payout_wallet: payoutWallet.trim() || undefined,
          author_name: authorName.trim() || undefined,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      const data = (await res.json()) as { error?: string; post?: { id: string } };
      if (!res.ok) {
        throw new Error(data.error ?? `Publish failed (${res.status})`);
      }

      toast.success("Post published", {
        description: data.post?.id ?? "Saved to marketplace",
      });

      setTitle("");
      setSubheading("");
      setBody("");
      setPriceUsdc(String(MIN_POST_PRICE_USDC));
      setPayoutWallet("");
      setAuthorName("");
      setTags("");
      setArticleExpanded(false);
      onPublished?.();
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
    }
  }, [
    authorName,
    body,
    connected,
    onPublished,
    payoutWallet,
    priceUsdc,
    subheading,
    tags,
    title,
  ]);

  const shortAddress = connected
    ? `${connected.slice(0, 6)}...${connected.slice(-4)}`
    : null;

  return (
    <Panel glow className="space-y-4 p-4 sm:p-5 border-[#f5c842]/20">
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
              ? "Step 1: connect wallet. Step 2: fill article details and sign."
              : "Creators — expand to connect wallet and list paywalled research."}
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

                <div className="space-y-2">
                  <Label htmlFor="publish-author" className="font-mono text-xs text-[#888]">
                    Display name (optional)
                  </Label>
                  <Input
                    id="publish-author"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Defaults to shortened wallet"
                    className="border-[#333] bg-[#111] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="publish-payout" className="font-mono text-xs text-[#888]">
                    Payout wallet (optional)
                  </Label>
                  <Input
                    id="publish-payout"
                    value={payoutWallet}
                    onChange={(e) => setPayoutWallet(e.target.value)}
                    placeholder="0x... receives unlock payments; defaults to connected wallet"
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
              </div>
            )}
          </div>

          <Button
            type="button"
            disabled={!walletAvailable || publishing}
            onClick={() => void publish()}
            className="w-full sm:w-auto border border-[#f5c842]/40 bg-[#f5c842]/10 text-[#f5c842] hover:bg-[#f5c842]/20 font-mono text-xs tracking-wide"
          >
            {publishing ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                Signing and publishing…
              </>
            ) : (
              "Sign and publish"
            )}
          </Button>
        </div>
      )}
    </Panel>
  );
}