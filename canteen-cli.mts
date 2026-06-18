import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  ARC_TESTNET_USDC,
  CANTEEN_USDC_ABI,
  getArcRpcUrl,
  getCanteenUsdcAddress,
} from "./lib/canteen-usdc.ts";

const USAGE = `Usage:
  node --experimental-transform-types --no-warnings --env-file=.env.local canteen-cli.mts wrap <amount>
  node --experimental-transform-types --no-warnings --env-file=.env.local canteen-cli.mts unwrap <amount>
  node --experimental-transform-types --no-warnings --env-file=.env.local canteen-cli.mts balance [address]

Examples:
  node canteen-cli.mts wrap 0.01
  node canteen-cli.mts unwrap 0.01
  node canteen-cli.mts balance`;

function parseAmount(raw: string | undefined): bigint {
  if (!raw) {
    console.error("Missing amount.");
    console.error(USAGE);
    process.exit(1);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error("Amount must be a positive number.");
    process.exit(1);
  }
  return parseUnits(raw, 6);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  const canteenAddress = getCanteenUsdcAddress();
  if (!canteenAddress) {
    console.error("Missing CANTEEN_USDC_ADDRESS in environment.");
    process.exit(1);
  }

  const privateKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey && command !== "balance") {
    console.error("Missing BUYER_PRIVATE_KEY for wrap/unwrap.");
    process.exit(1);
  }

  const rpcUrl = getArcRpcUrl();
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const walletAddress =
    command === "balance" && arg && arg.startsWith("0x")
      ? (arg as `0x${string}`)
      : ((process.env.BUYER_ADDRESS ?? privateKeyToAccount(privateKey!).address) as `0x${string}`);

  if (command === "balance") {
    const [usdcBalance, cUsdcBalance] = await Promise.all([
      publicClient.readContract({
        address: ARC_TESTNET_USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
      publicClient.readContract({
        address: canteenAddress,
        abi: CANTEEN_USDC_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
    ]);

    console.log(`Wallet: ${walletAddress}`);
    console.log(`USDC:   ${formatUnits(usdcBalance, 6)}`);
    console.log(`cUSDC:  ${formatUnits(cUsdcBalance, 6)}`);
    return;
  }

  const account = privateKeyToAccount(privateKey!);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  if (command === "wrap") {
    const amount = parseAmount(arg);
    const approveHash = await walletClient.writeContract({
      address: ARC_TESTNET_USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [canteenAddress, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const wrapHash = await walletClient.writeContract({
      address: canteenAddress,
      abi: CANTEEN_USDC_ABI,
      functionName: "wrap",
      args: [amount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: wrapHash });
    console.log(`Wrapped ${arg} USDC -> cUSDC`);
    console.log(`Tx: ${receipt.transactionHash}`);
    return;
  }

  if (command === "unwrap") {
    const amount = parseAmount(arg);
    const unwrapHash = await walletClient.writeContract({
      address: canteenAddress,
      abi: CANTEEN_USDC_ABI,
      functionName: "unwrap",
      args: [amount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: unwrapHash });
    console.log(`Unwrapped ${arg} cUSDC -> USDC`);
    console.log(`Tx: ${receipt.transactionHash}`);
    return;
  }

  console.error(USAGE);
  process.exit(1);
}

await main();