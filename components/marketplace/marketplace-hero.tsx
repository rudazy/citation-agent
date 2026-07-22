"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Coins, FileSearch, UserRound } from "lucide-react";
import { FollowHeroButton } from "@/components/marketplace/follow-discover-dialog";

export function MarketplaceHero() {
  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-[#0a0a0a] text-[#f5f5f5] p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#f5c842]/15 blur-3xl"
      />

      <div className="relative space-y-5">
        <Badge className="bg-[#f5c842]/15 text-[#f5c842] border border-[#f5c842]/30 hover:bg-[#f5c842]/15">
          Judgment marketplace
        </Badge>

        <div className="space-y-3 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide leading-snug">
            Turn crypto judgment into a revenue asset
          </h1>
          <p className="text-sm sm:text-[15px] leading-relaxed text-[#a3a3a3] font-mono">
            Browse paywalled research and Signal Cards, unlock with USDC, follow
            desks for new work, or publish your own. Humans and agents buy the same
            catalog through Circle Gateway.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="#research-catalog"
            className="inline-flex items-center rounded border border-[#f5c842]/40 bg-[#f5c842]/10 px-3 py-1.5 font-mono text-xs text-[#f5c842] hover:bg-[#f5c842]/20"
          >
            Browse catalog
          </a>
          <a
            href="#publish-signal"
            className="inline-flex items-center rounded border border-[#c8f135]/40 px-3 py-1.5 font-mono text-xs text-[#c8f135] hover:bg-[#c8f135]/10"
          >
            Publish a Signal
          </a>
          <a
            href="#publish-research"
            className="inline-flex items-center rounded border border-[#333] px-3 py-1.5 font-mono text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555]"
          >
            Publish research
          </a>
          <FollowHeroButton />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 max-w-3xl">
          <div className="flex gap-3 rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-3">
            <FileSearch size={16} className="mt-0.5 shrink-0 text-[#f5c842]" />
            <div>
              <p className="text-sm font-medium">For creators</p>
              <p className="text-xs text-[#666] font-mono">
                Open a Desk, post research or signals, share proof of judgment
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-3">
            <Coins size={16} className="mt-0.5 shrink-0 text-[#f5c842]" />
            <div>
              <p className="text-sm font-medium">For buyers</p>
              <p className="text-xs text-[#666] font-mono">
                Unlock with Gateway USDC, follow desks you trust
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-3">
            <UserRound size={16} className="mt-0.5 shrink-0 text-[#f5c842]" />
            <div>
              <p className="text-sm font-medium">For agents</p>
              <p className="text-xs text-[#666] font-mono">
                Pay per report via agent wallet — no popup per buy
              </p>
            </div>
          </div>
        </div>

        <p className="font-mono text-[10px] text-[#555]">
          Profiles at{" "}
          <span className="text-[#666]">/u/username</span>
          {" · "}
          reports at{" "}
          <span className="text-[#666]">/r/post-id</span>
          {" · "}
          <Link href="#following-feed" className="hover:text-[#f5c842]">
            your feed
          </Link>
        </p>
      </div>
    </section>
  );
}
