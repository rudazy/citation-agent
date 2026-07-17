import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  parseUnits,
} from "viem";
import { arcHttpTransport, isRpcRateLimitError } from "@/lib/arc-rpc";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import {
  ATTESTATION_ABI,
  MIN_CLAIM_CHARS,
  MIN_STAKE_UNITS,
  getAttestationAddress,
  totalAttestationCostUnits,
} from "@/lib/attestation";
import { invalidateAttestationCache } from "@/lib/attestation-index";
import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import {
  getAttestationFeeRecipient,
  recordAttestationPlatformFee,
} from "@/lib/record-attestation-fee";
import { requireUserAgent } from "@/lib/resolve-user-agent";

const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

const bodySchema = z.object({
  target: z.string().min(1),
  claim: z.string().trim().min(MIN_CLAIM_CHARS),
  stakeUsdc: z.number().min(0.1),
});

export async function POST(request: Request) {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) {
    return NextResponse.json({ error: "ATTESTATION_ADDRESS not configured" }, { status: 500 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let agent: Awaited<ReturnType<typeof requireUserAgent>>;
  try {
    agent = await requireUserAgent();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create your agent wallet first" },
      { status: 400 },
    );
  }

  // Multi-endpoint transport: public Arc RPC rate-limits under load; fallbacks
  // (Blockdaemon / dRPC / QuickNode / thirdweb) keep stake writes alive.
  const account = privateKeyToAccount(agent.privateKey);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: arcHttpTransport(),
  });

  const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: arcHttpTransport(),
    account,
  });

  const amount = parseUnits(body.stakeUsdc.toFixed(6), 6);
  if (amount < MIN_STAKE_UNITS) {
    return NextResponse.json({ error: "Minimum stake is 0.1 USDC" }, { status: 400 });
  }

  const recipient = getAttestationFeeRecipient();
  if (!recipient) {
    return NextResponse.json({ error: "SELLER_ADDRESS not configured" }, { status: 500 });
  }

  const totalCost = totalAttestationCostUnits(amount);
  const target = canonicalizeAttestationTarget(body.target);

  // Everything up to broadcasting the attest tx is safe to fail and retry.
  let attestHash: `0x${string}`;
  try {
    const walletBalance = await publicClient.readContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });

    if (walletBalance < totalCost) {
      return NextResponse.json(
        {
          error: `Insufficient agent USDC. Have ${formatUnits(walletBalance, 6)}, need ${formatUnits(totalCost, 6)} (stake + 0.1 platform fee)`,
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

    if (allowance < totalCost) {
      const approveHash = await walletClient.writeContract({
        address: ARC_USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [contractAddress, totalCost],
        account,
        chain: arcTestnet,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    attestHash = await walletClient.writeContract({
      address: contractAddress,
      abi: ATTESTATION_ABI,
      functionName: "attest",
      args: [target, body.claim.trim(), amount],
      account,
      chain: arcTestnet,
    });
  } catch (err) {
    console.error("[attestation] stake failed before broadcast:", err);
    if (isRpcRateLimitError(err)) {
      return NextResponse.json(
        {
          error:
            "Arc testnet RPC is rate-limited right now. Nothing was staked — wait a few seconds and retry.",
        },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "";
    const reverted = /revert/i.test(message);
    return NextResponse.json(
      {
        error: reverted
          ? "Stake transaction was rejected by the contract. Nothing was staked."
          : "Could not reach Arc testnet to send the stake. Nothing was staked — retry shortly.",
      },
      { status: reverted ? 400 : 502 },
    );
  }

  // The attest tx is broadcast: from here on, never return an error that
  // invites a retry — that would double-stake. Report the hash instead.
  let receiptPending = false;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: attestHash });
    if (receipt.status === "reverted") {
      return NextResponse.json(
        { error: `Stake transaction reverted on-chain (${attestHash}). Nothing was staked.` },
        { status: 400 },
      );
    }
  } catch (err) {
    console.warn("[attestation] receipt wait failed; tx already broadcast:", attestHash, err);
    receiptPending = true;
  }

  invalidateAttestationCache();

  await recordAttestationPlatformFee({
    attest_tx_hash: attestHash,
    staker: account.address,
    target,
    stake_usdc: body.stakeUsdc.toFixed(6),
    recipient,
  });

  return NextResponse.json({
    attestTxHash: attestHash,
    staker: account.address,
    platformFeeUsdc: "0.1",
    totalPaidUsdc: formatUnits(totalCost, 6),
    ...(receiptPending ? { receiptPending: true } : {}),
  });
}