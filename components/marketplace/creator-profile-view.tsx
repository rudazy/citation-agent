"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Link2, Loader2, Users } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";
import { AttestModal } from "@/components/attest";
import { AttestTrigger } from "@/components/attest/attest-trigger";
import { FollowCreatorButton } from "@/components/marketplace/follow-creator-button";
import { CreatorTipPanel } from "@/components/marketplace/creator-tip-panel";
import {
  ProfilePostCard,
  type ProfilePostCardData,
} from "@/components/marketplace/profile-post-card";
import { buildProfileUrl } from "@/lib/profile-url";
import {
  formatBackingHint,
  type ResearchBackingStats,
} from "@/lib/research-backing";
import { formatUsernameDisplay } from "@/lib/username";
import { toast } from "sonner";

type ProfilePayload = {
  username: string;
  displayName: string;
  followerCount: number;
  postCount: number;
  totalReaders: number;
  following: boolean;
  isSelf: boolean;
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
        setError("Creator not found");
        setData(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load profile (${res.status})`);
      }
      const json = (await res.json()) as ProfilePayload;
      setData(json);
      setFollowerCount(json.followerCount);
    } catch (err) {
      if (!options?.quiet) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
        setData(null);
      }
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyProfile = useCallback(async () => {
    try {
      const url = buildProfileUrl(username, window.location.origin);
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied", { description: url });
    } catch (err) {
      toast.error("Could not copy link", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [username]);

  const openBackResearcher = useCallback(() => {
    if (!data) return;
    setAttestTarget(`author:${data.username}`);
    setAttestOpen(true);
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl flex items-center justify-center gap-2 py-16 font-mono text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin text-[#f5c842]" />
        Loading profile…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          {error ?? "Creator not found"}
        </p>
        <Button asChild variant="outline" className="font-mono text-xs border-[#333]">
          <Link href="/marketplace">Back to research</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl w-full space-y-6">
      <Panel glow className="space-y-5 p-5 sm:p-6 border-[#f5c842]/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0">
            <p className="font-mono text-xs text-[#666] tracking-wide">Creator</p>
            <h1 className="text-2xl font-semibold tracking-wide text-[#f5f5f5]">
              {formatUsernameDisplay(data.username)}
            </h1>
            <p className="font-mono text-xs text-[#888] leading-relaxed max-w-md">
              Public research desk. View a report in the catalog to unlock and read.
              Tip or back this researcher from this profile.
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void copyProfile()}
              className="gap-1.5 font-mono text-xs text-[#888] hover:text-[#f5c842]"
            >
              <Link2 size={14} />
              Share profile
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-[#1f1f1f] pt-4">
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-[#666] uppercase tracking-wide">
              Reports
            </p>
            <p className="text-xl font-semibold tracking-wide text-[#f5f5f5]">
              {data.postCount}
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
        </div>

        {data.isSelf && formatBackingHint(data.researcher_backing) && (
          <p className="border-t border-[#1f1f1f] pt-3 font-mono text-[10px] text-[#888]">
            Your backing: {formatBackingHint(data.researcher_backing)}
          </p>
        )}

        {!data.isSelf && (
          <div className="grid gap-3 border-t border-[#1f1f1f] pt-4 sm:grid-cols-2">
            <CreatorTipPanel username={data.username} />
            <div className="rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold tracking-wide">Back researcher</p>
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
                Stake USDC behind this researcher on-chain. Same backing flow as the
                catalog.
              </p>
              <AttestTrigger
                target={`author:${data.username}`}
                onAttest={() => openBackResearcher()}
                label="Back researcher"
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        )}
      </Panel>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FileText size={16} className="text-[#f5c842]" />
          <h2 className="text-sm font-semibold tracking-wide">Published research</h2>
        </div>

        {data.posts.length === 0 ? (
          <p className="rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-8 text-center font-mono text-xs text-[#666]">
            No published reports yet.
          </p>
        ) : (
          <div className="grid gap-3">
            {data.posts.map((post) => (
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
