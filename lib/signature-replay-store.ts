/**
 * One-time signature consumption for wallet auth headers.
 *
 * Timestamp windows stop stale replays; this store stops reusing the same
 * signature bytes inside the window (capture-and-replay within 15 minutes).
 */

import { keccak256, toBytes } from "viem";
import { getAdminClient } from "@/lib/supabase/admin";

type MemoryEntry = { expiresAt: number };

const memory = new Map<string, MemoryEntry>();

export function hashAuthSignature(signature: string): string {
  const normalized = signature.trim().toLowerCase() as `0x${string}`;
  if (!/^0x[a-f0-9]+$/.test(normalized)) {
    throw new Error("Invalid signature");
  }
  return keccak256(toBytes(normalized)).toLowerCase();
}

function memoryKey(namespace: string, signatureHash: string): string {
  return `${namespace}:${signatureHash}`;
}

function pruneMemory(now: number): void {
  for (const [key, entry] of memory) {
    if (now >= entry.expiresAt) memory.delete(key);
  }
}

/**
 * Returns true when the signature is fresh and records it as consumed.
 * Returns false when the same signature was already used (replay).
 */
export async function consumeAuthSignature(
  namespace: string,
  walletAddress: string,
  signature: string,
  ttlMs: number,
  now: number = Date.now(),
): Promise<boolean> {
  const signatureHash = hashAuthSignature(signature);
  const key = memoryKey(namespace, signatureHash);
  pruneMemory(now);

  const cached = memory.get(key);
  if (cached && now < cached.expiresAt) return false;

  const supabase = getAdminClient();
  if (supabase) {
    const { data } = await supabase
      .from("used_auth_signatures")
      .select("expires_at")
      .eq("signature_hash", signatureHash)
      .maybeSingle();

    if (data?.expires_at) {
      const expiresAt = new Date(data.expires_at).getTime();
      if (Number.isFinite(expiresAt) && now < expiresAt) return false;
      await supabase.from("used_auth_signatures").delete().eq("signature_hash", signatureHash);
    }

    const expiresAt = new Date(now + ttlMs).toISOString();
    const { error } = await supabase.from("used_auth_signatures").insert({
      signature_hash: signatureHash,
      namespace,
      wallet_address: walletAddress.trim().toLowerCase(),
      expires_at: expiresAt,
    });

    if (error?.code === "23505") return false;
  }

  memory.set(key, { expiresAt: now + ttlMs });
  return true;
}

/** Test-only: clear in-memory replay cache. */
export function resetSignatureReplayStore(): void {
  memory.clear();
}