"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveUsername, type ProfileStatus } from "@/lib/profile-client";
import { cn } from "@/lib/utils";

type Props = {
  publisherAddress?: `0x${string}` | null;
  profile: ProfileStatus | null;
  onSaved: (profile: ProfileStatus) => void;
  submitLabel?: string;
  className?: string;
  compact?: boolean;
};

export function UsernameSetupForm({
  publisherAddress,
  profile,
  onSaved,
  submitLabel = "Save username",
  className,
  compact = false,
}: Props) {
  const [username, setUsername] = useState(profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changing = profile?.hasProfile === true;
  const canSubmit =
    !saving &&
    username.trim().length > 0 &&
    (!changing || profile?.canChangeUsername !== false);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveUsername(
        username,
        publisherAddress ?? undefined,
      );
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save username");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {!compact && (
        <p className="font-mono text-[10px] text-[#888] leading-relaxed">
          {changing
            ? "Your username is shared on comments and published research. Change it at most once every 7 days."
            : "Pick a unique username before commenting or publishing. No main wallet required."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#666]">
            @
          </span>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_name"
            disabled={saving || (changing && profile?.canChangeUsername === false)}
            className="border-[#333] bg-[#111] pl-7 font-mono text-sm"
            aria-label="Username"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="border-[#f5c842]/35 font-mono text-xs text-[#f5c842] hover:bg-[#f5c842]/10"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : submitLabel}
        </Button>
      </div>
      {changing && profile?.canChangeUsername === false && profile.nextChangeAt && (
        <p className="font-mono text-[10px] text-[#666]">
          Next change available {new Date(profile.nextChangeAt).toLocaleString()}
        </p>
      )}
      {error && <p className="font-mono text-[10px] text-red-400">{error}</p>}
    </div>
  );
}