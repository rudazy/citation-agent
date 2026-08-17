/**
 * One successful `attest()` transaction is one stake. The claims index must
 * never show that transaction twice.
 *
 * Arcscan's contract txlist has no log index, so it persists `logIndex: 0`.
 * eth_getLogs uses the real Attested log index, which is never 0 — USDC
 * Transfer events fire first. Merging on `txHash:logIndex` therefore keeps
 * both copies of the same stake (and inflates totals). Key by tx hash only.
 */
import { getAddress } from "viem";

/** Minimum fields the claims merge needs. Wider index rows satisfy this. */
export type MergeableAttestation = {
  txHash: `0x${string}` | null;
  staker: `0x${string}`;
};

export function attestationTxKey(
  txHash: `0x${string}` | string | null | undefined,
): string | null {
  if (!txHash) return null;
  const trimmed = txHash.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function checksumStaker(staker: `0x${string}`): `0x${string}` {
  try {
    return getAddress(staker);
  } catch {
    return staker.toLowerCase() as `0x${string}`;
  }
}

/**
 * Collapse rows that are the same on-chain attest. First writer wins so a
 * source that already resolved the tx (Arcscan, then logs) is not overwritten
 * by a lowercased store copy of the same hash.
 */
export function dedupeIndexedAttestations<T extends MergeableAttestation>(
  rows: T[],
): T[] {
  const byTx = new Map<string, T>();
  const withoutTx: T[] = [];

  for (const row of rows) {
    const key = attestationTxKey(row.txHash);
    if (!key) {
      withoutTx.push(row);
      continue;
    }
    if (byTx.has(key)) continue;
    byTx.set(key, {
      ...row,
      txHash: key as `0x${string}`,
      staker: checksumStaker(row.staker),
    });
  }

  return [...byTx.values(), ...withoutTx];
}
