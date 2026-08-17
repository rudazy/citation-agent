import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { arcHttpTransport, isRpcRateLimitError } from "@/lib/arc-rpc";
import { ATTESTATION_ABI, getAttestationAddress } from "@/lib/attestation";
import { invalidateAttestationCache } from "@/lib/attestation-index";
import { canonicalizeAttestationTarget } from "@/lib/attestation-client";
import { requireUserAgent } from "@/lib/resolve-user-agent";

const bodySchema = z.object({
  target: z.string().min(1),
  index: z.number().int().min(0),
  action: z.enum(["withdraw", "reclaim"]),
});

/**
 * Take a stake back out using the session agent wallet.
 *
 * Same "never invite a retry after broadcast" rule as POST /api/attestation:
 * once the hash is in flight, a second click would be a second transaction.
 */
export async function POST(request: Request) {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) {
    return NextResponse.json(
      { error: "ATTESTATION_ADDRESS not configured" },
      { status: 500 },
    );
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

  const target = canonicalizeAttestationTarget(body.target);
  const functionName =
    body.action === "withdraw" ? "withdraw" : "reclaimExpiredFreeze";

  let hash: `0x${string}`;
  try {
    hash = await walletClient.writeContract({
      address: contractAddress,
      abi: ATTESTATION_ABI,
      functionName,
      args: [target, BigInt(body.index)],
      account,
      chain: arcTestnet,
    });
  } catch (err) {
    console.error("[attestation/exit] failed before broadcast:", err);
    if (isRpcRateLimitError(err)) {
      return NextResponse.json(
        {
          error:
            "Arc testnet RPC is rate-limited right now. Nothing was withdrawn — wait a few seconds and retry.",
        },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "";
    const reverted = /revert/i.test(message);
    return NextResponse.json(
      {
        error: reverted
          ? message.replace(/^.*execution reverted:?\s*/i, "") ||
            "The contract rejected this exit."
          : "Could not reach Arc testnet to send the transaction. Nothing was withdrawn.",
      },
      { status: reverted ? 400 : 502 },
    );
  }

  let receiptPending = false;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      return NextResponse.json(
        { error: `Exit transaction reverted on-chain (${hash}). Funds did not move.` },
        { status: 400 },
      );
    }
  } catch (err) {
    console.warn("[attestation/exit] receipt wait failed; tx already broadcast:", hash, err);
    receiptPending = true;
  }

  invalidateAttestationCache();

  return NextResponse.json({
    txHash: hash,
    staker: account.address,
    action: body.action,
    ...(receiptPending ? { receiptPending: true } : {}),
  });
}
