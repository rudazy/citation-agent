import { NextResponse } from "next/server";
import { z } from "zod";
import { getAttestationFeeRecipient, recordAttestationPlatformFee } from "@/lib/record-attestation-fee";
import { verifyAttestationTx } from "@/lib/verify-attestation-tx";

const bodySchema = z.object({
  attestTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

/** Records a flat attestation platform fee after verifying the on-chain attest tx. */
export async function POST(request: Request) {
  const recipient = getAttestationFeeRecipient();
  if (!recipient) {
    return NextResponse.json({ error: "SELLER_ADDRESS not configured" }, { status: 500 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const verified = await verifyAttestationTx(body.attestTxHash as `0x${string}`);
  if (!verified) {
    return NextResponse.json({ error: "Attestation transaction not verified" }, { status: 400 });
  }

  const saved = await recordAttestationPlatformFee({
    attest_tx_hash: body.attestTxHash,
    staker: verified.staker,
    target: verified.target,
    stake_usdc: verified.stakeUsdc,
    platform_fee_usdc: verified.platformFeeUsdc,
    recipient,
  });

  return NextResponse.json({ recorded: saved, platformFeeUsdc: verified.platformFeeUsdc });
}