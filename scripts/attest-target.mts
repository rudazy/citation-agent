import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { ATTESTATION_ABI, getAttestationAddress } from "../lib/attestation.ts";

const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

async function main(): Promise<void> {
  const target = process.argv[2] ?? "x:@trustgated";
  const claim =
    process.argv[3] ??
    "TrustGate builds verifiable trust infrastructure for agents and citations on Arc.";
  const stakeUsdc = Number(process.argv[4] ?? "1");

  const contractAddress = getAttestationAddress();
  if (!contractAddress) throw new Error("ATTESTATION_ADDRESS not set");

  const privateKey = process.env.BUYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("BUYER_PRIVATE_KEY not set");

  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(normalizedKey as `0x${string}`);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain: arcTestnet, transport: http(rpcUrl), account });

  const amount = parseUnits(stakeUsdc.toFixed(6), 6);
  const balance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log(`Wallet:  ${account.address}`);
  console.log(`USDC:    ${formatUnits(balance, 6)}`);
  console.log(`Target:  ${target}`);
  console.log(`Stake:   ${stakeUsdc} USDC`);

  if (balance < amount) {
    throw new Error(`Insufficient USDC: have ${formatUnits(balance, 6)}, need ${stakeUsdc}`);
  }

  const allowance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, contractAddress],
  });

  if (allowance < amount) {
    console.log("Approving USDC…");
    const approveHash = await walletClient.writeContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress, amount],
      account,
      chain: arcTestnet,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`Approved: ${approveHash}`);
  }

  console.log("Attesting…");
  const attestHash = await walletClient.writeContract({
    address: contractAddress,
    abi: ATTESTATION_ABI,
    functionName: "attest",
    args: [target, claim, amount],
    account,
    chain: arcTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: attestHash });

  console.log(`Attest tx: ${attestHash}`);
  console.log(`Status:    ${receipt.status}`);
  console.log(`Explorer:  https://testnet.arcscan.app/tx/${attestHash}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});