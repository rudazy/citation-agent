/**
 * Supabase-backed eth_getLogs cursors, block timestamp cache, and attestation
 * event index. Service-role only. When Supabase is not configured, all helpers
 * no-op so local UI can still scan in-process (full range, slower).
 */

import { getAdminClient } from "@/lib/supabase/admin";

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export async function getLogCursor(address: string): Promise<bigint | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("log_cursors")
    .select("last_block")
    .eq("address", normalizeAddress(address))
    .maybeSingle();

  if (error) {
    console.warn("[log-cursors] get failed:", error.message);
    return null;
  }
  if (data?.last_block == null) return null;
  try {
    return BigInt(data.last_block);
  } catch {
    return null;
  }
}

/** Advance cursor only after a fully successful scan through lastBlock (inclusive). */
export async function setLogCursor(
  address: string,
  lastBlock: bigint,
): Promise<boolean> {
  const supabase = getAdminClient();
  if (!supabase) return false;

  const { error } = await supabase.from("log_cursors").upsert(
    {
      address: normalizeAddress(address),
      last_block: Number(lastBlock),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "address" },
  );

  if (error) {
    console.warn("[log-cursors] upsert failed:", error.message);
    return false;
  }
  return true;
}

export async function getBlockTimestamps(
  blockNumbers: bigint[],
): Promise<Map<bigint, number>> {
  const out = new Map<bigint, number>();
  if (blockNumbers.length === 0) return out;

  const supabase = getAdminClient();
  if (!supabase) return out;

  const unique = [...new Set(blockNumbers.map((b) => Number(b)))];
  // Cap single query size
  const batchSize = 200;
  for (let i = 0; i < unique.length; i += batchSize) {
    const slice = unique.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("arc_block_timestamps")
      .select("block_number, block_timestamp")
      .in("block_number", slice);

    if (error) {
      console.warn("[log-cursors] block timestamps load failed:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      out.set(BigInt(row.block_number), Number(row.block_timestamp));
    }
  }
  return out;
}

export async function upsertBlockTimestamps(
  entries: Array<{ blockNumber: bigint; timestamp: number }>,
): Promise<void> {
  if (entries.length === 0) return;
  const supabase = getAdminClient();
  if (!supabase) return;

  const rows = entries.map((e) => ({
    block_number: Number(e.blockNumber),
    block_timestamp: e.timestamp,
    updated_at: new Date().toISOString(),
  }));

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase
      .from("arc_block_timestamps")
      .upsert(rows.slice(i, i + batchSize), { onConflict: "block_number" });
    if (error) {
      console.warn("[log-cursors] block timestamps upsert failed:", error.message);
    }
  }
}

export type StoredAttestationEvent = {
  contractAddress: string;
  txHash: `0x${string}`;
  logIndex: number;
  target: string;
  claim: string;
  amountUnits: string;
  staker: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp: number;
};

export async function loadAttestationEvents(
  contractAddress: string,
): Promise<StoredAttestationEvent[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("attestation_event_index")
    .select(
      "contract_address, tx_hash, log_index, target, claim, amount_units, staker, block_number, block_timestamp",
    )
    .eq("contract_address", normalizeAddress(contractAddress))
    .order("block_number", { ascending: false });

  if (error) {
    console.warn("[log-cursors] load events failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    contractAddress: row.contract_address as string,
    txHash: row.tx_hash as `0x${string}`,
    logIndex: Number(row.log_index),
    target: row.target as string,
    claim: row.claim as string,
    amountUnits: String(row.amount_units),
    staker: row.staker as `0x${string}`,
    blockNumber: BigInt(row.block_number),
    blockTimestamp: Number(row.block_timestamp ?? 0),
  }));
}

export async function upsertAttestationEvents(
  events: StoredAttestationEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const supabase = getAdminClient();
  if (!supabase) return;

  const rows = events.map((e) => ({
    contract_address: normalizeAddress(e.contractAddress),
    tx_hash: e.txHash.toLowerCase(),
    log_index: e.logIndex,
    target: e.target,
    claim: e.claim,
    amount_units: e.amountUnits,
    staker: e.staker.toLowerCase(),
    block_number: Number(e.blockNumber),
    block_timestamp: e.blockTimestamp,
  }));

  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase
      .from("attestation_event_index")
      .upsert(rows.slice(i, i + batchSize), {
        onConflict: "contract_address,tx_hash,log_index",
      });
    if (error) {
      console.warn("[log-cursors] event upsert failed:", error.message);
    }
  }
}
