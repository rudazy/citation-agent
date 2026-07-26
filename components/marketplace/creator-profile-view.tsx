"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  FileText,
  Loader2,
  Radio,
  Stamp,
  Users,
} from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { AttestModal } from "@/components/attest";
import { AttestTrigger } from "@/components/attest/attest-trigger";
import { DeskAnalyticsStrip } from "@/components/marketplace/desk-analytics-strip";
import { DeskShareKit } from "@/components/marketplace/desk-share-kit";
import { FollowCreatorButton } from "@/components/marketplace/follow-creator-button";
import { ProfileOwnerSettings } from "@/components/marketplace/profile-owner-settings";
import { CreatorTipPanel } from "@/components/marketplace/creator-tip-panel";
import {
  ProfilePostCard,
  type ProfilePostCardData,
} from "@/components/marketplace/profile-post-card";
import {
  formatBackingHint,
  type ResearchBackingStats,
} from "@/lib/research-backing";
import { formatUsernameDisplay } from "@/lib/username";
import { formatPaymentDate } from "@/lib/format-datetime";
import { buildMarketplacePostPath } from "@/lib/post-share-url";
import { buildProfilePath } from "@/lib/profile-url";
import { cn } from "@/lib/utils";

type DeskTab = "all" | "research" | "signals" | "curation";

type CurationEntry = {
  post_id: string;
  title: string;
  author: string;
  price_usdc: string;
  post_kind: "research" | "signal";
  note: string | null;
  created_at: string;
  path: string;
};

type ProfilePayload = {
  username: string;
  displayName: string;
  followerCount: number;
  postCount: number;
  signalCount?: number;
  totalReaders: number;
  endorsementsReceived?: number;
  endorsementsGiven?: number;
  curation?: CurationEntry[];
  following: boolean;
  isSelf: boolean;
  verified_links?: string[];
  researcher_backing?: ResearchBackingStats | null;
  posts: ProfilePostCardData[];
};

export function CreatorProfileView({ username }: { username: string }) {
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [attestOpen, setAttestOpen] = useState(false);
  const [attestTarget, setAttestTarget] = useState("");
  const [tab, setTab] = useState<DeskTab>("all");

  const load = useCallback(async (options?: { refresh?: boolean; quiet?: boolean }) => {
    if (!options?.quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const q = options?.refresh ? "?refresh=1" : "";
      const res = await fetch(
        `/api/marketplace/profiles/${encodeURIComponent(username)}${q}`,
      );
      if (res.status === 404) {
        setError("Desk not found");
        setData(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load desk (${res.status})`);
      }
      const json = (await res.json()) as ProfilePayload;
      setData(json);
      setFollowerCount(json.followerCount);
    } catch (err) {
      if (!options?.quiet) {
        setError(err instanceof Error ? err.message : "Failed to load desk");
        setData(null);
      }
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  const openBackResearcher = useCallback(() => {
    if (!data) return;
    setAttestTarget(`author:${data.username}`);
    setAttestOpen(true);
  }, [data]);

  const signalCount = data?.signalCount ?? data?.posts.filter((p) => p.post_kind === "signal").length ?? 0;
  const researchCount = data?.postCount ?? 0;

  const curation = useMemo(() => data?.curation ?? [], [data]);

  const filteredPosts = useMemo(() => {
    if (!data || tab === "curation") return [];
    if (tab === "research") {
      return data.posts.filter((p) => p.post_kind !== "signal");
    }
    if (tab === "signals") {
      return data.posts.filter((p) => p.post_kind === "signal");
    }
    return data.posts;
  }, [data, tab]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl flex items-center justify-center gap-2 py-16 font-mono text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin text-[#f5c842]" />
        Loading desk…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          {error ?? "Desk not found"}
        </p>
        <Button asChild variant="outline" className="font-mono text-xs border-[#333]">
          <Link href="/marketplace">Back to marketplace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl w-full space-y-6">
      <Panel glow className="space-y-5 p-5 sm:p-6 border-[#f5c842]/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0">
            <p className="font-mono text-xs text-[#666] tracking-wide">
              Creator Desk
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-wide text-[#f5f5f5]">
              {formatUsernameDisplay(data.username)}
              {(data.verified_links?.length ?? 0) > 0 && (
                <span
                  title={`Verified links: ${data.verified_links!.join(", ")}`}
                  className="inline-flex items-center gap-1 rounded border border-[#c8f135]/30 bg-[#c8f135]/10 px-1.5 py-0.5 font-mono text-[10px] font-normal text-[#c8f135]"
                >
                  <BadgeCheck size={11} />
                  verified
                </span>
              )}
            </h1>
            <p className="font-mono text-xs text-[#888] leading-relaxed max-w-md">
              Judgment business: research, signals, and track record. Unlock in the
              catalog. Tip or back this desk from here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <FollowCreatorButton
              username={data.username}
              initialFollowing={data.following}
              isSelf={data.isSelf}
              onChange={(next) =>
                setFollowerCount((c) => Math.max(0, c + (next ? 1 : -1)))
              }
            />
          </div>
        </div>

        <DeskShareKit username={data.username} />

        <div className="grid grid-cols-2 gap-3 border-t border-[#1f1f1f] pt-4 sm:grid-cols-5">
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-[#666] uppercase tracking-wide">
              Research
            </p>
            <p className="text-xl font-semibold tracking-wide text-[#f5f5f5]">
              {researchCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-[#666] uppercase tracking-wide">
              Signals
            </p>
            <p className="text-xl font-semibold tracking-wide text-[#f5f5f5]">
              {signalCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-[#666] uppercase tracking-wide">
              Readers
            </p>
            <p className="text-xl font-semibold tracking-wide text-[#f5f5f5]">
              {data.totalReaders}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-[#666] uppercase tracking-wide">
              Followers
            </p>
            <p className="text-xl font-semibold tracking-wide text-[#f5f5f5] flex items-center gap-1.5">
              <Users size={16} className="text-[#f5c842]" />
              {followerCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-[#666] uppercase tracking-wide">
              Endorsed
            </p>
            <p className="text-xl font-semibold tracking-wide text-[#f5f5f5] flex items-center gap-1.5">
              <BadgeCheck size={16} className="text-[#f5c842]" />
              {data.endorsementsReceived ?? 0}
            </p>
          </div>
        </div>

        {data.isSelf && formatBackingHint(data.researcher_backing) && (
          <p className="border-t border-[#1f1f1f] pt-3 font-mono text-[10px] text-[#888]">
            Your backing: {formatBackingHint(data.researcher_backing)}
          </p>
        )}

        {data.isSelf && (
          <div className="space-y-4 border-t border-[#1f1f1f] pt-4">
            <DeskAnalyticsStrip />
            {signalCount === 0 && (
              <div className="rounded border border-[#c8f135]/25 bg-[#c8f135]/5 px-3 py-3 space-y-2">
                <p className="font-mono text-xs text-[#c8f135]">
                  First win: publish one Signal
                </p>
                <p className="font-mono text-[10px] text-[#888] leading-relaxed">
                  Claim is done. Open the marketplace, expand Publish a Signal, share
                  the link. Earn a tip or unlock.
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-[#c8f135]/40 font-mono text-xs text-[#c8f135]"
                >
                  <Link href="/marketplace#publish-signal">Publish a Signal</Link>
                </Button>
              </div>
            )}
            <ProfileOwnerSettings />
          </div>
        )}

        {!data.isSelf && (
          <div className="grid gap-3 border-t border-[#1f1f1f] pt-4 sm:grid-cols-2">
            <CreatorTipPanel username={data.username} />
            <div className="rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold tracking-wide">Back this desk</p>
                {formatBackingHint(data.researcher_backing) ? (
                  <span className="font-mono text-[10px] text-[#f5c842] tabular-nums">
                    {formatBackingHint(data.researcher_backing)}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-[#555]">
                    No backers yet
                  </span>
                )}
              </div>
              <p className="font-mono text-[10px] text-[#666] leading-relaxed">
                Stake USDC behind this desk on-chain. Same backing flow as the catalog.
              </p>
              <AttestTrigger
                target={`author:${data.username}`}
                onAttest={() => openBackResearcher()}
                label="Back desk"
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        )}
      </Panel>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#f5c842]" />
            <h2 className="text-sm font-semibold tracking-wide">Desk board</h2>
          </div>
          <div className="flex rounded border border-[#1f1f1f] p-0.5">
            {(
              [
                ["all", "All"],
                ["research", "Research"],
                ["signals", "Signals"],
                ["curation", `Curation${curation.length ? ` ${curation.length}` : ""}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
                  tab === id
                    ? "bg-[#f5c842]/15 text-[#f5c842]"
                    : "text-[#666] hover:text-[#aaa]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "curation" ? (
          curation.length === 0 ? (
            <p className="rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-8 text-center font-mono text-xs text-[#666]">
              This desk has not endorsed anyone else&apos;s work yet.
            </p>
          ) : (
            <div className="grid gap-3">
              {curation.map((entry) => (
                <article
                  key={entry.post_id}
                  className="rounded border border-[#1f1f1f] bg-[#111]/80 p-4 space-y-2 transition-colors hover:border-[#f5c842]/25"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#f5c842]">
                      <Stamp size={11} />
                      Endorsed
                    </span>
                    <span className="font-mono text-[10px] text-[#666]">
                      {entry.post_kind === "signal" ? "Signal" : "Research"} · $
                      {entry.price_usdc} USDC
                    </span>
                    <span className="font-mono text-[10px] text-[#666]">
                      {formatPaymentDate(entry.created_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
                    {entry.title}
                  </h3>
                  <p className="font-mono text-[10px] text-[#888]">
                    by{" "}
                    <Link
                      href={buildProfilePath(entry.author)}
                      className="text-[#a3a3a3] underline-offset-2 hover:text-[#f5c842] hover:underline"
                    >
                      @{entry.author}
                    </Link>
                  </p>
                  {entry.note && (
                    <p className="font-mono text-xs leading-relaxed text-[#888]">
                      &ldquo;{entry.note}&rdquo;
                    </p>
                  )}
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-[#333] font-mono text-xs text-[#a3a3a3]"
                  >
                    <Link href={buildMarketplacePostPath(entry.post_id)}>
                      View in catalog
                    </Link>
                  </Button>
                </article>
              ))}
            </div>
          )
        ) : filteredPosts.length === 0 ? (
          <p className="rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-8 text-center font-mono text-xs text-[#666]">
            {tab === "signals" ? (
              <span className="inline-flex items-center gap-1.5 justify-center">
                <Radio size={12} />
                No signals on this desk yet.
              </span>
            ) : tab === "research" ? (
              "No research reports yet."
            ) : (
              "No published judgment yet."
            )}
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredPosts.map((post) => (
              <ProfilePostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      <AttestModal
        isOpen={attestOpen}
        onClose={() => setAttestOpen(false)}
        target={attestTarget}
        copyMode="research"
        onSuccess={() => {
          void load({ refresh: true, quiet: true });
        }}
      />
    </div>
  );
}
