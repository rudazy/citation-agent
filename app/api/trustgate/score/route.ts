import { NextResponse } from "next/server";
import { isAddress, type PaymentProof } from "@/lib/trustgate-paid";
import { lookupScore, settleProof } from "@/lib/trustgate-oracle";

/**
 * GET ?address= : returns a cached score if one exists (so no second charge), or
 * the live 402 challenge (recipient + amount) the client needs to pay.
 */
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (!isAddress(address)) {
    return NextResponse.json({ status: "error", reason: "Invalid address" }, { status: 400 });
  }
  return NextResponse.json(await lookupScore(address));
}

/**
 * POST { address, proof } : relays a payment proof produced by the user's own
 * MetaMask wallet and returns the score. The server never holds funds.
 */
export async function POST(request: Request) {
  let payload: { address?: unknown; proof?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ status: "error", reason: "Invalid JSON body" }, { status: 400 });
  }

  const address = typeof payload.address === "string" ? payload.address.trim() : "";
  if (!isAddress(address)) {
    return NextResponse.json({ status: "error", reason: "Invalid address" }, { status: 400 });
  }

  const proof = payload.proof as Partial<PaymentProof> | undefined;
  if (
    !proof ||
    typeof proof.txHash !== "string" ||
    typeof proof.nonce !== "string" ||
    typeof proof.from !== "string" ||
    typeof proof.network !== "string"
  ) {
    return NextResponse.json(
      { status: "error", reason: "Invalid payment proof" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    await settleProof(address, {
      txHash: proof.txHash,
      nonce: proof.nonce,
      from: proof.from,
      network: proof.network,
    }),
  );
}
