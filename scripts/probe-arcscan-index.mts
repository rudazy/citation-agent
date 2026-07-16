import { indexAttestationsFromArcscan } from "../lib/arcscan-attestations.ts";

const address = (process.env.ATTESTATION_ADDRESS ||
  process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS) as `0x${string}`;
const deploy = BigInt(process.env.ATTESTATION_DEPLOY_BLOCK || "48323587");

async function main() {
  const result = await indexAttestationsFromArcscan({
    contractAddress: address,
    deployBlock: deploy,
    latestBlock: BigInt("999999999"),
    persist: false,
  });
  console.log({
    complete: result.complete,
    pages: result.pagesFetched,
    events: result.events.length,
    error: result.errorMessage,
  });
  const byTarget = new Map<string, number>();
  for (const row of result.rows) {
    byTarget.set(
      row.canonicalTarget,
      (byTarget.get(row.canonicalTarget) ?? 0) + 1,
    );
  }
  console.log("targets", byTarget.size);
  for (const [t, n] of [...byTarget.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}  ${t}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
