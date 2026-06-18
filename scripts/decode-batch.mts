import { decodeBatch } from "../lib/decode-batch.ts";

const txHash = process.argv[2] as `0x${string}` | undefined;
if (!txHash || !txHash.startsWith("0x")) {
  console.error("usage: npm run decode-batch -- <tx-hash>");
  process.exit(1);
}

const b = await decodeBatch(txHash);
const pad = (s: string, n = 18) => s.padEnd(n);

console.log(`${pad("tx")}${b.txHash}`);
console.log(`${pad("block")}${b.blockNumber}`);
console.log(`${pad("relayer (from)")}${b.relayer}`);
console.log(`${pad("contract (to)")}${b.contract}`);
console.log(`${pad("batch id")}${b.batchId}`);
console.log(`${pad("domain")}${b.domain}${b.domain === 26 ? " (Arc)" : ""}`);
console.log(`${pad("token")}${b.token}`);
console.log(`${pad("inner contract")}${b.innerContract}`);
console.log(`\nentries (${b.entries.length}):`);
for (const e of b.entries) {
  const v = e.usdc.startsWith("-") ? e.usdc : "+" + e.usdc;
  console.log(`  ${v.padStart(14)} USDC  ${e.address}`);
}
console.log(`\nnet transfers (${b.netTransfers.length}):`);
for (const t of b.netTransfers) {
  console.log(`  ${t.from} -> ${t.to}  ${t.usdc} USDC`);
}