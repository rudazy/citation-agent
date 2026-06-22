import { getSellerAddress } from "@/lib/payment-wallets";
import { ATTESTATION_PLATFORM_FEE_USDC } from "@/lib/attestation";
import { getAdminClient } from "@/lib/supabase/admin";

export type AttestationFeeInsert = {
  attest_tx_hash: string;
  staker: string;
  target: string;
  stake_usdc: string;
  platform_fee_usdc?: string;
  recipient: string;
};

export async function recordAttestationPlatformFee(
  event: AttestationFeeInsert,
): Promise<boolean> {
  const supabase = getAdminClient();
  if (!supabase) {
    console.warn(
      "[attestation-fees] Supabase not configured — platform fee settled on-chain but not saved to dashboard.",
    );
    return false;
  }

  const row = {
    attest_tx_hash: event.attest_tx_hash,
    staker: event.staker,
    target: event.target,
    stake_usdc: event.stake_usdc,
    platform_fee_usdc: event.platform_fee_usdc ?? String(ATTESTATION_PLATFORM_FEE_USDC),
    recipient: event.recipient,
  };

  const { error } = await supabase.from("attestation_platform_fees").insert(row);
  if (error) {
    if (error.code === "23505") return true;
    console.error("[attestation-fees] Insert failed:", error.message);
    return false;
  }
  return true;
}

export function getAttestationFeeRecipient(): `0x${string}` | null {
  return getSellerAddress();
}