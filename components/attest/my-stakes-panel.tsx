"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Lock, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  exitStakeViaConnectedWallet,
  getAttestationContractAddress,
  getConnectedAccount,
} from "@/lib/attestation-client";
import {
  activeStakeTotalUsdc,
  isTerminal,
  ownStakes,
  stakeAction,
  statusLabel,
  type StakeRecord,
} from "@/lib/attestation-stake";

const EXPLORER = "https://testnet.arcscan.app/tx/";

/**
 * The connected wallet's own stakes on a target, with the exit action the
 * contract currently permits.
 *
 * Reads /api/attestation/stakes rather than the claims index: only
 * `getAttestations` returns a stake's array index and status, and `withdraw`
 * needs the index.
 */
export function MyStakesPanel({
  target,
  indexedStakers = [],
}: {
  target: string;
  /**
   * Staker addresses from the claims index, which spans the current contract
   * and superseded ones. A wallet listed here with no stake on the current
   * contract staked on a superseded one — where there is no exit path at all.
   */
  indexedStakers?: string[];
}) {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [stakes, setStakes] = useState<StakeRecord[]>([]);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [doneTx, setDoneTx] = useState<{ index: number; hash: string } | null>(null);

  const load = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;

    setLoading(true);
    setError(null);
    try {
      const connected = await getConnectedAccount(window.ethereum);
      setAccount(connected);

      const res = await fetch(
        `/api/attestation/stakes?target=${encodeURIComponent(target)}&staker=${connected}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        stakes?: StakeRecord[];
        nowSeconds?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load your stakes");

      setStakes(data.stakes ?? []);
      // Server clock, so a skewed browser clock cannot unlock a button early.
      if (typeof data.nowSeconds === "number") setNowSeconds(data.nowSeconds);
    } catch (err) {
      setStakes([]);
      setError(err instanceof Error ? err.message : "Could not load your stakes");
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    setDoneTx(null);
    void load();
  }, [load]);

  const onExit = useCallback(
    async (stake: StakeRecord, action: "withdraw" | "reclaim") => {
      const contractAddress = getAttestationContractAddress();
      if (!contractAddress) {
        setError("NEXT_PUBLIC_ATTESTATION_ADDRESS is not set.");
        return;
      }
      if (!window.ethereum || !account) {
        setError("Connect a wallet first.");
        return;
      }

      setBusyIndex(stake.index);
      setError(null);
      try {
        const { txHash } = await exitStakeViaConnectedWallet({
          ethereum: window.ethereum,
          account,
          contractAddress,
          target: stake.target,
          index: stake.index,
          action,
        });
        setDoneTx({ index: stake.index, hash: txHash });
        await load();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        // Contract guards are the authority; surface their reason verbatim.
        setError(message.replace(/^.*execution reverted:?\s*/i, "") || message);
      } finally {
        setBusyIndex(null);
      }
    },
    [account, load],
  );

  const mine = ownStakes(stakes, account);

  // Staked here before the current contract: those funds are locked in a
  // contract with no withdraw, release, or slash function. Say so plainly
  // rather than showing an empty panel.
  const hasLegacyOnly =
    Boolean(account) &&
    mine.length === 0 &&
    indexedStakers.some((s) => s.toLowerCase() === account?.toLowerCase());

  if (!account && !loading && !error) return null;
  if (account && mine.length === 0 && !hasLegacyOnly && !loading && !error) {
    return null;
  }

  const recoverable = activeStakeTotalUsdc(mine);

  return (
    <section className="mt-4 rounded border border-[#1f1f1f] bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-2 border-b border-[#1f1f1f] bg-[#141414]/60 px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#666]">
          <Wallet size={12} />
          Your stakes
        </span>
        {recoverable !== "0" && (
          <span className="font-mono text-xs text-[#f5c842] tabular-nums">
            {recoverable} USDC open
          </span>
        )}
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {loading && mine.length === 0 && (
          <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            Loading your stakes
          </p>
        )}

        {error && (
          <p className="font-mono text-xs text-[#ff8a3d]" role="alert">
            {error}
          </p>
        )}

        {hasLegacyOnly && !loading && (
          <p className="font-mono text-[11px] leading-relaxed text-[#666]">
            Your stakes on this target were filed on the superseded attestation
            contract, which has no withdrawal path. Those funds cannot be
            recovered by anyone. Stakes filed from now on settle on the current
            contract and can be withdrawn once their lock elapses.
          </p>
        )}

        {mine.map((stake) => {
          const action = stakeAction(stake, nowSeconds);
          const busy = busyIndex === stake.index;
          const settled = doneTx?.index === stake.index ? doneTx.hash : null;

          return (
            <div
              key={stake.index}
              className="flex flex-wrap items-center justify-between gap-2 border-l border-[#1f1f1f] pl-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-[#f5f5f5] tabular-nums">
                  {stake.amountUsdc} USDC
                  {isTerminal(stake.status) && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-[#333] font-mono text-[10px] text-[#a3a3a3]"
                    >
                      {statusLabel(stake.status)}
                    </Badge>
                  )}
                </p>
                {action.kind === "none" ? (
                  <p className="flex items-center gap-1 font-mono text-[10px] text-[#666]">
                    {!isTerminal(stake.status) && <Lock size={10} />}
                    {action.reason}
                  </p>
                ) : (
                  <p className="font-mono text-[10px] text-[#666]">
                    Available now
                  </p>
                )}
                {settled && (
                  <a
                    href={`${EXPLORER}${settled}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 pt-1 font-mono text-[10px] text-[#ff8a3d] hover:underline"
                  >
                    View transaction
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>

              {action.kind !== "none" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onExit(stake, action.kind)}
                  className="h-7 gap-1.5 border-[#f5c842]/30 px-2 text-[10px] text-[#f5c842] hover:bg-[#f5c842]/10 hover:text-[#f5c842]"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : null}
                  {busy ? "Confirming" : action.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
