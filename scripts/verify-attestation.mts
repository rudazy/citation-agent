import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const ARCSCAN_API = "https://testnet.arcscan.app/api";

function getStandardJsonInput(): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const sourcePath = path.join(root, "contracts", "Attestation.sol");
  const source = fs.readFileSync(sourcePath, "utf8");

  return JSON.stringify({
    language: "Solidity",
    sources: { "contracts/Attestation.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    },
  });
}

async function pollGuid(apiKey: string, guid: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const url = new URL(ARCSCAN_API);
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "checkverifystatus");
    url.searchParams.set("guid", guid);
    if (apiKey) url.searchParams.set("apikey", apiKey);

    const res = await fetch(url);
    const data = (await res.json()) as { status?: string; result?: string };
    const result = data.result ?? "";
    console.log(`Verify status: ${result}`);

    if (result.toLowerCase().includes("pass")) return;
    if (result.toLowerCase().includes("fail")) {
      throw new Error(`Verification failed: ${result}`);
    }
  }
  throw new Error("Verification timed out");
}

function readContractAddress(): string {
  const flagIdx = process.argv.indexOf("--address");
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    return process.argv[flagIdx + 1];
  }
  const envAddress = process.env.ATTESTATION_ADDRESS;
  if (envAddress) return envAddress;
  throw new Error("Pass --address or set ATTESTATION_ADDRESS");
}

async function main(): Promise<void> {
  const contractAddress = readContractAddress();

  const apiKey = process.env.ARCSCAN_API_KEY ?? "";
  const body = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    contractaddress: contractAddress,
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/Attestation.sol:Attestation",
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    sourceCode: getStandardJsonInput(),
  });
  if (apiKey) body.set("apikey", apiKey);

  const res = await fetch(ARCSCAN_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as { status?: string; message?: string; result?: string };
  if (data.status !== "1") {
    throw new Error(`Verify submit failed: ${data.message ?? data.result ?? JSON.stringify(data)}`);
  }

  console.log(`Verification submitted. GUID: ${data.result}`);
  await pollGuid(apiKey, data.result!);
  console.log(`Verified: https://testnet.arcscan.app/address/${contractAddress}#code`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}