"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Verification = {
  kind: "website" | "x" | "substack" | "youtube";
  url: string;
  code: string;
  verified: boolean;
};

const KIND_LABELS: Record<Verification["kind"], string> = {
  website: "Website",
  substack: "Substack",
  x: "X account",
  youtube: "YouTube",
};

/**
 * Prove ownership of an external page (Substack about, personal site, X bio)
 * by placing a one-time code there — bridges existing reputation onto the
 * profile without exposing the wallet.
 */
export function ProfileVerificationPanel({ className }: { className?: string }) {
  const [kind, setKind] = useState<Verification["kind"]>("website");
  const [url, setUrl] = useState("");
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/verification", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { verifications?: Verification[] };
      setVerifications(data.verifications ?? []);
    } catch {
      // Quiet — the panel is optional.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = verifications.find((v) => v.kind === kind);

  const requestCode = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/profile/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "request", kind, url }),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create a code");
      toast.success("Verification code created", {
        description: `Add ${data.code} to that page, then press Check.`,
      });
      await load();
    } catch (err) {
      toast.error("Verification request failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [kind, load, url]);

  const runCheck = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/profile/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "verify", kind }),
      });
      const data = (await res.json()) as { error?: string; verified?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      toast.success("Link verified", {
        description: "Your profile now shows a verified-link badge.",
      });
      await load();
    } catch (err) {
      toast.error("Not verified yet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [kind, load]);

  return (
    <div className={cn("rounded border border-[#1f1f1f] bg-[#111]/60 px-3 py-3 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <BadgeCheck size={14} className="text-[#f5c842]" />
        <p className="text-sm font-semibold tracking-wide">Verify your links</p>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-[#666]">
        Prove you own your website, X, Substack, or YouTube presence without exposing
        your wallet. Get a code, place it on the page (about, bio, or channel
        description), then check.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(KIND_LABELS) as Verification["kind"][]).map((k) => {
          const v = verifications.find((entry) => entry.kind === k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setUrl(verifications.find((entry) => entry.kind === k)?.url ?? "");
              }}
              className={cn(
                "rounded border px-2.5 py-1 font-mono text-[10px] transition-colors",
                kind === k
                  ? "border-[#f5c842]/50 bg-[#f5c842]/10 text-[#f5c842]"
                  : "border-[#2a2a2a] bg-[#111] text-[#888] hover:border-[#444]",
              )}
            >
              {KIND_LABELS[k]}
              {v?.verified && <BadgeCheck size={10} className="ml-1 inline text-[#c8f135]" />}
            </button>
          );
        })}
      </div>

      {current?.verified ? (
        <p className="font-mono text-[11px] text-[#c8f135]">
          Verified: {current.url}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="verify-url" className="font-mono text-xs text-[#888]">
              Public page URL
            </Label>
            <Input
              id="verify-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                kind === "x"
                  ? "https://x.com/yourhandle"
                  : kind === "substack"
                    ? "https://you.substack.com/about"
                    : kind === "youtube"
                      ? "https://www.youtube.com/@you/about"
                      : "https://yoursite.com/about"
              }
              className="border-[#333] bg-[#111] font-mono text-sm"
            />
          </div>
          {current && !current.verified && (
            <p className="font-mono text-[10px] text-[#a3a3a3]">
              Place this code on the page: {" "}
              <code className="rounded bg-[#1a1a1a] px-1 py-0.5 text-[#f5c842]">
                {current.code}
              </code>
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !url.trim()}
              onClick={() => void requestCode()}
              className="h-7 border-[#333] font-mono text-[10px]"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : "Get code"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !current}
              onClick={() => void runCheck()}
              className="h-7 border-[#333] font-mono text-[10px]"
            >
              Check
            </Button>
          </div>
          {kind === "x" && (
            <p className="font-mono text-[10px] text-[#666]">
              Note: X often blocks server checks. If checking fails, verify a website or
              Substack instead.
            </p>
          )}
        </>
      )}
    </div>
  );
}
