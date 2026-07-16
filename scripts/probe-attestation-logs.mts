/**
 * Probe eth_getLogs reliability + list targets via Arcscan if available.
 *   node --experimental-transform-types --no-warnings --env-file=.env.local scripts/probe-attestation-logs.mts
 */
import {
  createPublicClient,
  decodeFunctionData,
  formatUnits,
  http,
  type AbiEvent,
} from "viem";
import { arcTestnet } from "viem/chains";
import { ATTESTATION_ABI } from "../lib/attestation.ts";

const address = (process.env.ATTESTATION_ADDRESS ||
  process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS) as `0x${string}`;
const deploy = BigInt(process.env.ATTESTATION_DEPLOY_BLOCK || "48323587");
const rpc = process.env.ARC_TESTNET_RPC || "https://rpc.testnet.arc.network";
const arcscanBase =
  process.env.ARCSCAN_BASE?.trim() || "https://testnet.arcscan.app";
const arcscanKey = process.env.ARCSCAN_API_KEY?.trim() || "";

const ATTESTED: AbiEvent = {
  type: "event",
  name: "Attested",
  inputs: [
    { name: "target", type: "string", indexed: true },
    { name: "staker", type: "address", indexed: true },
    { name: "claim", type: "string", indexed: false },
    { name: "amount", type: "uint256", indexed: false },
    { name: "platformFee", type: "uint256", indexed: false },
  ],
};

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(rpc),
});

async function tryChunk(from: bigint, to: bigint): Promise<number | string> {
  try {
    const part = await client.getLogs({
      address,
      event: ATTESTED,
      fromBlock: from,
      toBlock: to,
    });
    return part.length;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 200) : String(e);
  }
}

async function probeGetLogsSizes(latest: bigint) {
  const sizes = [50n, 100n, 200n, 500n, 800n, 1000n, 2000n];
  const start = latest > 10_000n ? latest - 10_000n : deploy;
  console.log("\n=== getLogs size probe (from", start.toString(), ") ===");
  for (const size of sizes) {
    const to = start + size - 1n;
    const result = await tryChunk(start, to > latest ? latest : to);
    console.log(`  size=${size.toString()} →`, result);
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function probeArcscan(latest: bigint) {
  console.log("\n=== Arcscan getLogs API ===");
  // Etherscan-compatible: module=logs&action=getLogs
  const topic0 =
    "0x" +
    // keccak256("Attested(string,address,string,uint256,uint256)")
    // computed at runtime via viem if needed — use hardcoded from chain
    "";

  // Prefer account tx list for contract as fallback
  const url = new URL(`${arcscanBase}/api`);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", deploy.toString());
  url.searchParams.set("endblock", latest.toString());
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "100");
  url.searchParams.set("sort", "desc");
  if (arcscanKey) url.searchParams.set("apikey", arcscanKey);

  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      status?: string;
      message?: string;
      result?: Array<{ hash: string; input: string; from: string; timeStamp: string }>;
    };
    console.log("arcscan status", json.status, json.message);
    const txs = Array.isArray(json.result) ? json.result : [];
    console.log("txs returned", txs.length);

    const byTarget = new Map<string, { count: number; usdc: number }>();
    for (const tx of txs) {
      if (!tx.input || tx.input === "0x") continue;
      try {
        const decoded = decodeFunctionData({
          abi: ATTESTATION_ABI,
          data: tx.input as `0x${string}`,
        });
        if (decoded.functionName !== "attest") continue;
        const [target, , amount] = decoded.args as [string, string, bigint];
        const prev = byTarget.get(target) ?? { count: 0, usdc: 0 };
        prev.count += 1;
        prev.usdc += Number(formatUnits(amount, 6));
        byTarget.set(target, prev);
      } catch {
        // not an attest call
      }
    }
    const rows = [...byTarget.entries()].sort((a, b) => b[1].usdc - a[1].usdc);
    console.log("targets from arcscan txlist:", rows.length);
    for (const [t, s] of rows) {
      console.log(`  ${t}  claims=${s.count}  usdc=${s.usdc.toFixed(2)}`);
    }
  } catch (e) {
    console.log("arcscan failed", e instanceof Error ? e.message : e);
  }
}

async function main() {
  const latest = await client.getBlockNumber();
  console.log({
    address,
    deploy: deploy.toString(),
    latest: latest.toString(),
    span: (latest - deploy).toString(),
    rpc,
  });

  await probeGetLogsSizes(latest);
  await probeArcscan(latest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
