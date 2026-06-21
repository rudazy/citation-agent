import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ARC_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

function compileContract(): { abi: readonly unknown[]; bytecode: Hex } {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const sourcePath = path.join(root, "contracts", "Attestation.sol");
  const source = fs.readFileSync(sourcePath, "utf8");

  const input = {
    language: "Solidity",
    sources: { "Attestation.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    errors?: { severity: string; formattedMessage: string }[];
    contracts?: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
  };

  const errors = (output.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  }

  const artifact = output.contracts?.["Attestation.sol"]?.Attestation;
  if (!artifact?.evm?.bytecode?.object) {
    throw new Error("Compilation failed: missing bytecode");
  }

  return {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}` as Hex,
  };
}

function readPrivateKey(): string {
  const flagIdx = process.argv.indexOf("--private-key");
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    return process.argv[flagIdx + 1];
  }
  const envKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.BUYER_PRIVATE_KEY;
  if (envKey) return envKey;
  throw new Error("Pass --private-key or set DEPLOYER_PRIVATE_KEY / BUYER_PRIVATE_KEY");
}

async function main(): Promise<void> {
  const privateKey = readPrivateKey();

  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  const { abi, bytecode } = compileContract();

  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(normalizedKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: ARC_CHAIN,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: ARC_CHAIN,
    transport: http(rpcUrl),
    account,
  });

  const balance = await publicClient.getBalance({ address: account.address });

  console.log(`Deployer: ${account.address}`);
  console.log(`Balance:  ${formatEther(balance)} USDC (native gas)`);

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    account,
    chain: ARC_CHAIN,
  });

  console.log(`Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;

  if (!contractAddress) {
    throw new Error("Deployment failed: no contract address in receipt");
  }

  console.log(`Attestation deployed: ${contractAddress}`);
  console.log(`Explorer: https://testnet.arcscan.app/address/${contractAddress}`);
  console.log(`\nAdd to .env.local:\nATTESTATION_ADDRESS=${contractAddress}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}