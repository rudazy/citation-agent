"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Scale, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  arbiterActionViaConnectedWallet,
  getAttestationContractAddress,
  getConnectedAccount,
} from "@/lib/attestation-client";
import { resolutionDisputeTarget } from "@/lib/signal-resolution";
import type { DisputeStage, SettlementAction } from "@/lib/dispute-settlement";

const EXPLORER = "https://testnet.arcscan.app/tx/";

type QueueEntry = {
  post_id: string;
  title: string;
  author: string;
  stage: DisputeStage;
  outcome: string;
  adjudicated_outcome: string | null;
  disputed_at: string | null;
  dispute_stake_usdc: string | null;
  dispute_reason: string | null;
  dispute_tx: string | null;
  stake_index: number | null;
  stake_frozen_at: string | null;
  next: { action: SettlementAction; index: number; target: string } | null;
  blocked_reason: string | null;
};

const STAGE_LABEL: Record<DisputeStage, string> = {
  none: "No dispute",
  awaiting_freeze: "Needs freeze",
  frozen: "Awaiting verdict",
  awaiting_settlement: "Needs settlement",
  settled: "Settled",
};

/**
 * Operator queue for disputed stakes.
 *
 * Arbiter powers sit with the operator wallet and there is no server-side key,
 * so every action here is a transaction signed in the browser; the hash is then
 * posted to the API, which verifies it against the contract before recording it.
 */
export function DisputeQueue({
  getAuthHeaders,
}: {
  getAuthHeaders: () => Promise<Record<string, string>>;
}) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [slashFor, setSlashFor] = useState<string | null>(null);
  const [beneficiary, setBeneficiary] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/resolutions/queue", {
        headers: await getAuthHeaders(),
        cache: "no-store",
      });
      const data = (await res.json()) as { disputes?: QueueEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load disputes");
      setEntries(data.disputes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load disputes");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (
      entry: QueueEntry,
      action: "freeze" | SettlementAction,
      beneficiary?: string,
    ) => {
      const contractAddress = getAttestationContractAddress();
      if (!contractAddress) {
        setError("NEXT_PUBLIC_ATTESTATION_ADDRESS is not set.");
        return;
      }
      if (entry.stake_index == null) {
        setError(
          "This dispute has no on-chain stake index — the stake predates the current contract.",
        );
        return;
      }
      if (!window.ethereum) {
        setError("Connect the operator wallet first.");
        return;
      }

      setBusyId(entry.post_id);
      setError(null);
      try {
        const account = await getConnectedAccount(window.ethereum);
        const { txHash } = await arbiterActionViaConnectedWallet({
          ethereum: window.ethereum,
          account,
          contractAddress,
          target: resolutionDisputeTarget(entry.post_id),
          index: entry.stake_index,
          action,
          beneficiary: beneficiary as `0x${string}` | undefined,
        });

        const endpoint =
          action === "freeze"
            ? "/api/marketplace/resolutions/freeze"
            : "/api/marketplace/resolutions/settle";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ postId: entry.post_id, txHash }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to record the transaction");

        await load();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message.replace(/^.*execution reverted:?\s*/i, "") || message);
      } finally {
        setBusyId(null);
      }
    },
    [getAuthHeaders, load],
  );

  const onSettle = useCallback(
    (entry: QueueEntry) => {
      if (!entry.next) return;
      if (entry.next.action === "release") {
        void send(entry, "release");
        return;
      }
      // A slash pays someone else's stake to an address of the operator's
      // choosing, so it opens an explicit confirm field rather than firing.
      setSlashFor(entry.post_id);
      setBeneficiary("");
    },
    [send],
  );

  const confirmSlash = useCallback(
    (entry: QueueEntry) => {
      const address = beneficiary.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        setError("Beneficiary must be a valid address");
        return;
      }
      setSlashFor(null);
      void send(entry, "slash", address);
    },
    [beneficiary, send],
  );

  if (!loading && entries.length === 0 && !error) return null;

  return (
    <section className="rounded border border-[#1f1f1f] bg-[#111] p-4">
      <div className="flex items-center justify-between gap-2 pb-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#666]">
          <Scale size={13} />
          Disputed stakes
        </span>
        {entries.length > 0 && (
          <Badge variant="outline" className="border-[#333] font-mono text-[10px]">
            {entries.length}
          </Badge>
        )}
      </div>

      {error && (
        <p className="pb-3 font-mono text-xs text-[#ff8a3d]" role="alert">
          {error}
        </p>
      )}

      {loading && entries.length === 0 && (
        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          Loading disputes
        </p>
      )}

      <div className="space-y-3">
        {entries.map((entry) => {
          const busy = busyId === entry.post_id;
          return (
            <div
              key={entry.post_id}
              className="flex flex-wrap items-start justify-between gap-3 border-l border-[#1f1f1f] pl-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-mono text-sm text-[#f5f5f5]">
                  {entry.title}
                </p>
                <p className="font-mono text-[10px] text-[#666]">
                  @{entry.author} · called {entry.outcome}
                  {entry.adjudicated_outcome
                    ? ` · adjudicated ${entry.adjudicated_outcome}`
                    : " · not yet adjudicated"}
                </p>
                <p className="flex items-center gap-2 font-mono text-[10px] text-[#666]">
                  <Badge
                    variant="outline"
                    className="border-[#333] font-mono text-[10px] text-[#a3a3a3]"
                  >
                    {STAGE_LABEL[entry.stage]}
                  </Badge>
                  {entry.dispute_stake_usdc} USDC staked
                  {entry.stake_index != null && ` · index ${entry.stake_index}`}
                </p>
                {entry.dispute_reason && (
                  <p className="font-mono text-[10px] leading-relaxed text-[#a3a3a3]">
                    “{entry.dispute_reason}”
                  </p>
                )}
                {entry.blocked_reason && (
                  <p className="font-mono text-[10px] text-[#666]">
                    {entry.blocked_reason}
                  </p>
                )}
                {entry.dispute_tx && (
                  <a
                    href={`${EXPLORER}${entry.dispute_tx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-[#ff8a3d] hover:underline"
                  >
                    Stake tx
                    <ExternalLink size={9} />
                  </a>
                )}

                {slashFor === entry.post_id && (
                  <div className="space-y-1.5 pt-1">
                    <label
                      htmlFor={`beneficiary-${entry.post_id}`}
                      className="block font-mono text-[10px] text-[#a3a3a3]"
                    >
                      Pay {entry.dispute_stake_usdc} USDC to — this is permanent
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        id={`beneficiary-${entry.post_id}`}
                        value={beneficiary}
                        onChange={(e) => setBeneficiary(e.target.value)}
                        placeholder="0x…"
                        spellCheck={false}
                        className="w-[22rem] max-w-full rounded border border-[#333] bg-[#0a0a0a] px-2 py-1 font-mono text-[11px] text-[#f5f5f5] outline-none focus:border-[#f5c842]/50"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => confirmSlash(entry)}
                        className="h-7 border-[#f5c842]/30 px-2 text-[10px] text-[#f5c842] hover:bg-[#f5c842]/10 hover:text-[#f5c842]"
                      >
                        Confirm slash
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSlashFor(null)}
                        className="h-7 px-2 text-[10px] text-[#666]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {entry.stage === "awaiting_freeze" && entry.stake_index != null && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void send(entry, "freeze")}
                    className="h-7 gap-1.5 border-[#333] px-2 text-[10px]"
                  >
                    {busy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Snowflake size={12} />
                    )}
                    Freeze
                  </Button>
                )}
                {entry.next && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onSettle(entry)}
                    className="h-7 gap-1.5 border-[#f5c842]/30 px-2 text-[10px] text-[#f5c842] hover:bg-[#f5c842]/10 hover:text-[#f5c842]"
                  >
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    {entry.next.action === "release" ? "Release" : "Slash"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
