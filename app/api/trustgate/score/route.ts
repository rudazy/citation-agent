import { NextResponse } from "next/server";
import { resolveIdentityWalletForPost } from "@/lib/resolve-post-identity";
import { isAddress, type PaymentProof } from "@/lib/trustgate-paid";
import { lookupScore, settleProof } from "@/lib/trustgate-oracle";

async function resolveLookupTarget(params: {
  postId: string | null;
  address: string | null;
}): Promise<`0x${string}` | null | "invalid"> {
  if (params.postId) {
    const wallet = await resolveIdentityWalletForPost(params.postId);
    return wallet ?? "invalid";
  }
  if (params.address && isAddress(params.address)) {
    return params.address;
  }
  return null;
}

/**
 * GET ?postId= or ?address= : cached score or live 402 challenge.
 * postId resolves the identity wallet server-side; the address is never returned.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId")?.trim() ?? "";
  const addressParam = url.searchParams.get("address")?.trim() ?? "";

  if (!postId && !addressParam) {
    return NextResponse.json(
      { status: "error", reason: "postId or address required" },
      { status: 400 },
    );
  }

  const target = await resolveLookupTarget({
    postId: postId || null,
    address: addressParam || null,
  });

  if (target === null) {
    return NextResponse.json(
      { status: "error", reason: "Invalid postId or address" },
      { status: 400 },
    );
  }
  if (target === "invalid") {
    return NextResponse.json({ status: "error", reason: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(await lookupScore(target));
}

/**
 * POST { postId, proof } or { address, proof } : relay payment proof, return score.
 */
export async function POST(request: Request) {
  let payload: { postId?: unknown; address?: unknown; proof?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ status: "error", reason: "Invalid JSON body" }, { status: 400 });
  }

  const postId = typeof payload.postId === "string" ? payload.postId.trim() : "";
  const addressParam = typeof payload.address === "string" ? payload.address.trim() : "";

  const target = await resolveLookupTarget({
    postId: postId || null,
    address: addressParam || null,
  });

  if (target === null) {
    return NextResponse.json(
      { status: "error", reason: "postId or address required" },
      { status: 400 },
    );
  }
  if (target === "invalid") {
    return NextResponse.json({ status: "error", reason: "Post not found" }, { status: 404 });
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
    await settleProof(target, {
      txHash: proof.txHash,
      nonce: proof.nonce,
      from: proof.from,
      network: proof.network,
    }),
  );
}