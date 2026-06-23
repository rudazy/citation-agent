import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseEther,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { resolveIdentityWalletForPost } from "@/lib/resolve-post-identity";
import { requireUserAgent } from "@/lib/resolve-user-agent";
import { buildPaymentProof, isAddress } from "@/lib/trustgate-paid";
import { lookupScore, settleProof } from "@/lib/trustgate-oracle";

const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
const FAUCET = "https://faucet.circle.com/";

/**
 * POST { postId } or { address } : pays the oracle fee from the session agent
 * wallet server side, then relays the proof. postId resolves identity wallet
 * without exposing it to the client.
 */
export async function POST(request: Request) {
  let payload: { postId?: unknown; address?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ status: "error", reason: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof payload.postId === "string" ? payload.postId.trim() : "";
  const addressParam = typeof payload.address === "string" ? payload.address.trim() : "";

  let address: `0x${string}` | null = null;
  if (postId) {
    address = await resolveIdentityWalletForPost(postId);
    if (!address) {
      return NextResponse.json({ status: "error", reason: "Post not found" }, { status: 404 });
    }
  } else if (isAddress(addressParam)) {
    address = addressParam;
  } else {
    return NextResponse.json(
      { status: "error", reason: "postId or address required" },
      { status: 400 },
    );
  }

  // Cached score, or the live challenge to pay. Cache hit means no second charge.
  const lookup = await lookupScore(address);
  if (lookup.status === "cached") {
    return NextResponse.json({ status: "cached", score: lookup.score });
  }
  if (lookup.status === "unconfigured") {
    return NextResponse.json({ status: "unconfigured" });
  }
  if (lookup.status === "error") {
    return NextResponse.json({ status: "failed", reason: lookup.reason });
  }

  const challenge = lookup.challenge;

  // Load the session agent wallet (same path the attestation route uses).
  let agent: Awaited<ReturnType<typeof requireUserAgent>>;
  try {
    agent = await requireUserAgent();
  } catch (err) {
    return NextResponse.json({
      status: "failed",
      reason: err instanceof Error ? err.message : "No agent wallet for this browser",
    });
  }

  const account = privateKeyToAccount(agent.privateKey);
  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });

  const value = parseUnits(challenge.amount, 6);

  try {
    // Enough USDC to cover the fee?
    const usdc = await publicClient.readContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    if (usdc < value) {
      return NextResponse.json({
        status: "failed",
        reason: `Agent wallet needs ${challenge.amount} USDC to pay the fee (has ${formatUnits(usdc, 6)}). Fund it via ${FAUCET}`,
      });
    }

    // Enough native USDC for gas? (Arc pays gas in native USDC.)
    const native = await publicClient.getBalance({ address: account.address });
    let gasNeeded: bigint;
    try {
      const gas = await publicClient.estimateContractGas({
        address: ARC_USDC,
        abi: erc20Abi,
        functionName: "transfer",
        args: [challenge.recipient, value],
        account,
      });
      gasNeeded = gas * (await publicClient.getGasPrice()) * BigInt(2);
    } catch {
      gasNeeded = parseEther("0.001");
    }
    if (native < gasNeeded) {
      return NextResponse.json({
        status: "failed",
        reason: `Agent wallet needs native USDC on Arc for gas. Fund it via ${FAUCET}`,
      });
    }
  } catch {
    return NextResponse.json({
      status: "failed",
      reason: "Could not read agent wallet balances. Try again shortly.",
    });
  }

  // Pay the fee on-chain from the agent wallet.
  let txHash: `0x${string}`;
  try {
    txHash = await walletClient.writeContract({
      address: ARC_USDC,
      abi: erc20Abi,
      functionName: "transfer",
      args: [challenge.recipient, value],
      account,
      chain: arcTestnet,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (err) {
    return NextResponse.json({
      status: "failed",
      reason: err instanceof Error ? err.message : "Agent payment failed",
    });
  }

  const proof = buildPaymentProof({
    txHash,
    from: account.address,
    network: challenge.network,
  });

  return NextResponse.json(await settleProof(address, proof));
}
