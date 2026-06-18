import {
  createPublicClient,
  decodeFunctionData,
  getAddress,
  hexToBigInt,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { getArcRpcUrl } from "@/lib/canteen-usdc";

const GATEWAY_API =
  process.env.GATEWAY_API ?? "https://gateway-api-testnet.circle.com";
const SETTLEMENT_WINDOW_MS = 10_000;

const SUBMIT_BATCH_ABI = parseAbi([
  "function submitBatch(bytes calldataBytes, bytes signature)",
]);

export type BatchEntry = {
  address: `0x${string}`;
  delta: bigint;
  usdc: string;
};

export type NetTransfer = {
  from: `0x${string}`;
  to: `0x${string}`;
  usdc: string;
};

export type Settlement = {
  id: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  createdAt: string;
  updatedAt: string;
};

export type DecodedBatch = {
  txHash: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp: number;
  relayer: `0x${string}`;
  contract: `0x${string}`;
  batchId: `0x${string}`;
  domain: number;
  token: `0x${string}`;
  innerContract: `0x${string}`;
  entries: BatchEntry[];
  netTransfers: NetTransfer[];
  settlementsByBuyer: Record<string, Settlement[]>;
};

export async function decodeBatch(txHash: `0x${string}`): Promise<DecodedBatch> {
  const client = createPublicClient({ transport: http(getArcRpcUrl()) });
  const tx = await client.getTransaction({ hash: txHash });
  if (!tx.to) throw new Error("contract creation, not a submitBatch");

  const decoded = decodeFunctionData({
    abi: SUBMIT_BATCH_ABI,
    data: tx.input,
  });
  if (decoded.functionName !== "submitBatch") {
    throw new Error(`not submitBatch (got ${decoded.functionName})`);
  }
  const [calldataBytesHex] = decoded.args;
  const calldata = (calldataBytesHex as Hex).slice(2);

  const word = (i: number) => calldata.slice(i * 64, (i + 1) * 64);
  const addrFromWord = (i: number) =>
    getAddress(("0x" + word(i).slice(24)) as `0x${string}`);
  const intFromWord = (i: number, signed = false) =>
    hexToBigInt(("0x" + word(i)) as Hex, { signed });

  const batchId = ("0x" + word(1)) as Hex;
  const domain = Number(intFromWord(2));
  const token = addrFromWord(3);
  const innerContract = addrFromWord(4);
  const count = Number(intFromWord(5));

  const entries: BatchEntry[] = [];
  for (let i = 0; i < count; i++) {
    const address = addrFromWord(6 + i * 2);
    const delta = intFromWord(7 + i * 2, true);
    entries.push({ address, delta, usdc: formatSignedUsdc(delta) });
  }

  const negatives = entries.filter((e) => e.delta < BigInt(0));
  const positives = [...entries.filter((e) => e.delta > BigInt(0))];
  const netTransfers: NetTransfer[] = [];
  for (const n of negatives) {
    const idx = positives.findIndex((p) => p.delta === -n.delta);
    if (idx >= 0) {
      netTransfers.push({
        from: n.address,
        to: positives[idx].address,
        usdc: formatSignedUsdc(-n.delta),
      });
      positives.splice(idx, 1);
    }
  }

  const blockNumber = tx.blockNumber ?? BigInt(0);
  const block = await client.getBlock({ blockNumber });
  const blockTimestamp = Number(block.timestamp);

  const buyerAddrs = Array.from(
    new Set(
      entries.filter((e) => e.delta < BigInt(0)).map((e) => e.address.toLowerCase()),
    ),
  );
  const settlementsByBuyer: Record<string, Settlement[]> = {};
  await Promise.all(
    buyerAddrs.map(async (addr) => {
      try {
        const r = await fetch(`${GATEWAY_API}/v1/x402/transfers?from=${addr}`);
        if (!r.ok) return;
        const data = (await r.json()) as { transfers?: Settlement[] };
        const blockMs = blockTimestamp * 1000;
        settlementsByBuyer[addr] = (data.transfers ?? []).filter((t) => {
          if (t.status !== "completed" && t.status !== "confirmed") return false;
          return (
            Math.abs(new Date(t.updatedAt).getTime() - blockMs) <
            SETTLEMENT_WINDOW_MS
          );
        });
      } catch {
        // leave entry absent on network failure
      }
    }),
  );

  return {
    txHash,
    blockNumber,
    blockTimestamp,
    relayer: tx.from,
    contract: tx.to,
    batchId,
    domain,
    token,
    innerContract,
    entries,
    netTransfers,
    settlementsByBuyer,
  };
}

function formatSignedUsdc(v: bigint): string {
  const sign = v < BigInt(0) ? "-" : "";
  const abs = v < BigInt(0) ? -v : v;
  const whole = abs / BigInt(1_000_000);
  const frac = (abs % BigInt(1_000_000)).toString().padStart(6, "0");
  return `${sign}${whole}.${frac}`;
}

export function serializeDecodedBatch(decoded: DecodedBatch) {
  return {
    ...decoded,
    blockNumber: decoded.blockNumber.toString(),
    entries: decoded.entries.map((e) => ({
      address: e.address,
      deltaRaw: e.delta.toString(),
      usdc: e.usdc,
    })),
  };
}