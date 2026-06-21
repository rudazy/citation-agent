import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { ATTESTATION_ABI, MIN_STAKE_UNITS, getAttestationAddress } from "@/lib/attestation";

const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

const bodySchema = z.object({
  target: z.string().min(1),
  claim: z.string().min(1),
  stakeUsdc: z.number().min(0.1),
});

export async function POST(request: Request) {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) {
    return NextResponse.json({ error: "ATTESTATION_ADDRESS not configured" }, { status: 500 });
  }

  const privateKey = process.env.BUYER_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json({ error: "Agent wallet not configured" }, { status: 500 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(normalizedKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
    account,
  });

  const amount = parseUnits(body.stakeUsdc.toFixed(6), 6);
  if (amount < MIN_STAKE_UNITS) {
    return NextResponse.json({ error: "Minimum stake is 0.1 USDC" }, { status: 400 });
  }

  const walletBalance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (walletBalance < amount) {
    return NextResponse.json(
      {
        error: `Insufficient agent USDC. Have ${formatUnits(walletBalance, 6)}, need ${body.stakeUsdc}`,
      },
      { status: 400 },
    );
  }

  const allowance = await publicClient.readContract({
    address: ARC_USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, contractAddress],
  });

  if (allowance < amount) {
    const approveHash = await walletClient.writeContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress, amount],
      account,
      chain: arcTestnet,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const attestHash = await walletClient.writeContract({
    address: contractAddress,
    abi: ATTESTATION_ABI,
    functionName: "attest",
    args: [body.target.trim(), body.claim.trim(), amount],
    account,
    chain: arcTestnet,
  });

  await publicClient.waitForTransactionReceipt({ hash: attestHash });

  return NextResponse.json({
    attestTxHash: attestHash,
    staker: account.address,
  });
}