/**
 * Index Attestation.sol events via Arcscan (Etherscan-compatible API).
 * Public Arc eth_getLogs is unreliable (rate limits / hard failures), so Arcscan
 * contract txlist is the durable source of truth for the Claims tab.
 */

import { decodeFunctionData, formatUnits, getAddress } from "viem";
import { ATTESTATION_ABI } from "@/lib/attestation";
import {
  upsertAttestationEvents,
  type StoredAttestationEvent,
} from "@/lib/log-cursors";
import {
  canonicalizeAttestationTarget,
} from "@/lib/attestation-client";

const DEFAULT_ARCSCAN = "https://testnet.arcscan.app";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export type ArcscanIndexedAttestation = {
  target: string;
  canonicalTarget: string;
  claim: string;
  amountUsdc: string;
  amountUnits: bigint;
  staker: `0x${string}`;
  timestamp: number;
  txHash: `0x${string}`;
  logIndex: number;
  blockNumber: bigint;
};

type ArcscanTx = {
  hash: string;
  input: string;
  from: string;
  timeStamp: string;
  blockNumber: string;
  isError?: string;
  txreceipt_status?: string;
};

function arcscanBase(): string {
  return (process.env.ARCSCAN_BASE?.trim() || DEFAULT_ARCSCAN).replace(/\/$/, "");
}

function apiKey(): string {
  return process.env.ARCSCAN_API_KEY?.trim() || "";
}

async function fetchTxPage(
  contractAddress: string,
  startBlock: bigint,
  endBlock: bigint,
  page: number,
): Promise<ArcscanTx[]> {
  const url = new URL(`${arcscanBase()}/api`);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", contractAddress);
  url.searchParams.set("startblock", startBlock.toString());
  url.searchParams.set("endblock", endBlock.toString());
  url.searchParams.set("page", String(page));
  url.searchParams.set("offset", String(PAGE_SIZE));
  url.searchParams.set("sort", "desc");
  const key = apiKey();
  if (key) url.searchParams.set("apikey", key);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    // Server-side only
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Arcscan HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    status?: string;
    message?: string;
    result?: ArcscanTx[] | string;
  };

  // Etherscan returns status "0" with message "No transactions found"
  if (!Array.isArray(json.result)) {
    if (
      typeof json.result === "string" &&
      /no transactions/i.test(json.result)
    ) {
      return [];
    }
    if (json.status === "0" && /no transactions/i.test(json.message ?? "")) {
      return [];
    }
    throw new Error(
      `Arcscan error: ${json.message ?? json.result ?? "unknown"}`,
    );
  }

  return json.result;
}

function decodeAttestTx(
  tx: ArcscanTx,
  contractAddress: string,
): StoredAttestationEvent | null {
  if (!tx.input || tx.input === "0x") return null;
  if (tx.isError === "1" || tx.txreceipt_status === "0") return null;

  try {
    const decoded = decodeFunctionData({
      abi: ATTESTATION_ABI,
      data: tx.input as `0x${string}`,
    });
    if (decoded.functionName !== "attest") return null;
    const [target, claim, amount] = decoded.args as [string, string, bigint];
    const staker = getAddress(tx.from);
    const blockNumber = BigInt(tx.blockNumber || "0");
    const blockTimestamp = Number(tx.timeStamp || "0");

    return {
      contractAddress,
      txHash: tx.hash as `0x${string}`,
      // txlist has no log index; one attest per successful tx is the normal path
      logIndex: 0,
      target,
      claim,
      amountUnits: amount.toString(),
      staker,
      blockNumber,
      blockTimestamp,
    };
  } catch {
    return null;
  }
}

export type ArcscanIndexResult = {
  events: StoredAttestationEvent[];
  rows: ArcscanIndexedAttestation[];
  complete: boolean;
  pagesFetched: number;
  errorMessage?: string;
};

/**
 * Pull attest transactions for the contract from Arcscan and optionally persist.
 */
export async function indexAttestationsFromArcscan(params: {
  contractAddress: `0x${string}`;
  deployBlock: bigint;
  latestBlock: bigint;
  persist?: boolean;
}): Promise<ArcscanIndexResult> {
  const { contractAddress, deployBlock, latestBlock } = params;
  const persist = params.persist !== false;

  const events: StoredAttestationEvent[] = [];
  const seenTx = new Set<string>();
  let pagesFetched = 0;
  let errorMessage: string | undefined;
  let complete = true;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const txs = await fetchTxPage(
        contractAddress,
        deployBlock,
        latestBlock,
        page,
      );
      pagesFetched = page;

      if (txs.length === 0) break;

      for (const tx of txs) {
        const key = tx.hash?.toLowerCase();
        if (!key || seenTx.has(key)) continue;
        seenTx.add(key);
        const decoded = decodeAttestTx(tx, contractAddress);
        if (decoded) events.push(decoded);
      }

      if (txs.length < PAGE_SIZE) break;

      // Small pause between pages to stay polite to Arcscan.
      await new Promise((r) => setTimeout(r, 150));

      if (page === MAX_PAGES) {
        complete = false;
        errorMessage = "Arcscan page cap reached; more history may exist";
      }
    }
  } catch (err) {
    complete = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    console.warn("[arcscan-attestations]", errorMessage);
  }

  if (persist && events.length > 0) {
    await upsertAttestationEvents(events);
  }

  const rows: ArcscanIndexedAttestation[] = events.map((e) => {
    const amountUnits = BigInt(e.amountUnits);
    return {
      target: e.target,
      canonicalTarget: canonicalizeAttestationTarget(e.target),
      claim: e.claim,
      amountUnits,
      amountUsdc: formatUnits(amountUnits, 6),
      staker: e.staker,
      timestamp: e.blockTimestamp,
      txHash: e.txHash,
      logIndex: e.logIndex,
      blockNumber: e.blockNumber,
    };
  });

  return {
    events,
    rows: rows.sort((a, b) => b.timestamp - a.timestamp),
    complete,
    pagesFetched,
    errorMessage,
  };
}
