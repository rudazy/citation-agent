"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Lock, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  exitStakeViaAgentWallet,
  exitStakeViaConnectedWallet,
  fetchAgentWalletStatus,
  formatTargetLabel,
  getAttestationContractAddress,
  getConnectedAccount,
} from "@/lib/attestation-client";
import { getAuthorizedAccount } from "@/lib/wallet-connection-client";
import { attestationTargetHref } from "@/lib/attestation-target-href";
import {
  activeStakeTotalUsdc,
  isTerminal,
  stakeAction,
  statusLabel,
  type IndexedStakeHint,
  type StakeRecord,
} from "@/lib/attestation-stake";

const EXPLORER = "https://testnet.arcscan.app/tx/";

type WalletKind = "agent" | "metamask";

type LoadedWallet = {
  kind: WalletKind;
  address: `0x${string}`;
  live: StakeRecord[];
  legacy: IndexedStakeHint[];
  nowSeconds: number;
};

function stakeKey(stake: StakeRecord): string {
  return `${stake.target}:${stake.index}:${stake.staker.toLowerCase()}`;
}

function TargetLink({ target }: { target: string }) {
  const href = attestationTargetHref(target);
  const label = formatTargetLabel(target);
  if (!href) {
    return <span className="font-mono text-[11px] text-[#888]">{label}</span>;
  }
  return (
    <Link
      href={href}
      className="font-mono text-[11px] text-[#c8f135] underline-offset-2 hover:underline"
    >
      {label}
    </Link>
  );
}

export function DeskMyStakes() {
  const [wallets, setWallets] = useState<LoadedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [doneTx, setDoneTx] = useState<{ key: string; hash: string } | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const addresses: Array<{ kind: WalletKind; address: `0x${string}` }> = [];

      const agent = await fetchAgentWalletStatus();
      if (agent.address) {
        addresses.push({ kind: "agent", address: agent.address });
      }

      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const connected = await getAuthorizedAccount(window.ethereum);
          if (
            connected &&
            !addresses.some((a) => a.address.toLowerCase() === connected.toLowerCase())
          ) {
            addresses.push({ kind: "metamask", address: connected });
          }
        } catch {
          // No connected wallet is fine — agent-only listing still works.
        }
      }

      if (addresses.length === 0) {
        setWallets([]);
        return;
      }

      const loaded: LoadedWallet[] = [];
      for (const entry of addresses) {
        const res = await fetch(
          `/api/attestation/stakes?staker=${entry.address}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          stakes?: StakeRecord[];
          legacy?: IndexedStakeHint[];
          nowSeconds?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not load your stakes");
        loaded.push({
          kind: entry.kind,
          address: entry.address,
          live: data.stakes ?? [],
          legacy: data.legacy ?? [],
          nowSeconds:
            typeof data.nowSeconds === "number"
              ? data.nowSeconds
              : Math.floor(Date.now() / 1000),
        });
      }
      setWallets(loaded);
      if (loaded[0]) setNowSeconds(loaded[0].nowSeconds);
    } catch (err) {
      setWallets([]);
      setError(err instanceof Error ? err.message : "Could not load your stakes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds((n) => n + 30);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const live = useMemo(() => {
    const rows: Array<StakeRecord & { wallet: WalletKind }> = [];
    const seen = new Set<string>();
    for (const wallet of wallets) {
      for (const stake of wallet.live) {
        const key = stakeKey(stake);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ ...stake, wallet: wallet.kind });
      }
    }
    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }, [wallets]);

  const legacy = useMemo(() => {
    const rows: IndexedStakeHint[] = [];
    const seen = new Set<string>();
    for (const wallet of wallets) {
      for (const stake of wallet.legacy) {
        const key = (stake.txHash ?? `${stake.target}:${stake.timestamp}`).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(stake);
      }
    }
    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }, [wallets]);

  const signerFor = useCallback(
    (staker: string): WalletKind | null => {
      const key = staker.toLowerCase();
      const match = wallets.find((w) => w.address.toLowerCase() === key);
      return match?.kind ?? null;
    },
    [wallets],
  );

  const onExit = useCallback(
    async (stake: StakeRecord, action: "withdraw" | "reclaim") => {
      const signer = signerFor(stake.staker);
      if (!signer) {
        setError("Connect the wallet that filed this stake to withdraw it.");
        return;
      }

      const key = stakeKey(stake);
      setBusyKey(key);
      setError(null);
      try {
        let hash: string;
        if (signer === "agent") {
          const result = await exitStakeViaAgentWallet({
            target: stake.target,
            index: stake.index,
            action,
          });
          hash = result.txHash;
        } else {
          const contractAddress = getAttestationContractAddress();
          if (!contractAddress || !window.ethereum) {
            throw new Error("Connect MetaMask to withdraw this stake.");
          }
          const account = await getConnectedAccount(window.ethereum);
          const result = await exitStakeViaConnectedWallet({
            ethereum: window.ethereum,
            account,
            contractAddress,
            target: stake.target,
            index: stake.index,
            action,
          });
          hash = result.txHash;
        }
        setDoneTx({ key, hash });
        await load();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message.replace(/^.*execution reverted:?\s*/i, "") || message);
      } finally {
        setBusyKey(null);
      }
    },
    [load, signerFor],
  );

  const recoverable = activeStakeTotalUsdc(live);
  const walletLabels = wallets
    .map((w) => `${w.kind === "agent" ? "agent" : "MetaMask"} ${w.address.slice(0, 6)}…${w.address.slice(-4)}`)
    .join(" · ");

  return (
    <section className="rounded border border-[#1f1f1f] bg-[#0a0a0a]">
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
        {walletLabels && (
          <p className="font-mono text-[10px] text-[#555]">{walletLabels}</p>
        )}
        {!loading && !wallets.some((w) => w.kind === "metamask") && (
          <p className="font-mono text-[10px] text-[#555]">
            Connect MetaMask to also list stakes filed from that wallet.
          </p>
        )}

        {loading && live.length === 0 && legacy.length === 0 && (
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

        {!loading && live.length === 0 && legacy.length === 0 && !error && (
          <p className="font-mono text-[11px] leading-relaxed text-[#666]">
            No stakes from your agent wallet or connected MetaMask. Back a desk
            and it will show up here with the lock countdown.
          </p>
        )}

        {live.map((stake) => {
          const action = stakeAction(stake, nowSeconds);
          const key = stakeKey(stake);
          const busy = busyKey === key;
          const settled = doneTx?.key === key ? doneTx.hash : null;

          return (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-2 border-l border-[#1f1f1f] pl-3"
            >
              <div className="min-w-0 space-y-0.5">
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
                <TargetLink target={stake.target} />
                {action.kind === "none" ? (
                  <p className="flex items-center gap-1 font-mono text-[10px] text-[#666]">
                    {!isTerminal(stake.status) && <Lock size={10} />}
                    {action.reason}
                  </p>
                ) : (
                  <p className="font-mono text-[10px] text-[#666]">Available now</p>
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

        {legacy.length > 0 && (
          <div className="space-y-2 border-t border-[#1f1f1f] pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#666]">
              Earlier contract · no withdrawal path
            </p>
            <p className="font-mono text-[11px] leading-relaxed text-[#666]">
              These were filed on the superseded attestation contract. Those
              funds cannot be recovered by anyone. Stakes filed from now on sit
              on the current contract and can be withdrawn once the lock ends.
            </p>
            {legacy.map((stake) => (
              <div
                key={stake.txHash ?? `${stake.target}:${stake.timestamp}`}
                className="flex flex-wrap items-center justify-between gap-2 border-l border-[#1f1f1f] pl-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-mono text-sm text-[#888] tabular-nums">
                    {stake.amountUsdc} USDC
                  </p>
                  <TargetLink target={stake.target} />
                </div>
                {stake.txHash && (
                  <a
                    href={`${EXPLORER}${stake.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-[#888] hover:text-[#ff8a3d]"
                  >
                    Arcscan
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
