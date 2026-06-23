import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isPaidTrustLookupAvailable } from "@/lib/creator-trust";
import { getSellerAddress, sellerConfigError } from "@/lib/payment-wallets";

export async function GET() {
  const clientConfigured = isSupabaseConfigured();
  const serverConfigured = getAdminClient() !== null;
  const attestation =
    process.env.ATTESTATION_ADDRESS ?? process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS ?? null;

  return NextResponse.json({
    supabase: {
      client: clientConfigured,
      server: serverConfigured,
      ready: clientConfigured && serverConfigured,
    },
    marketplace: {
      seller_configured: getSellerAddress() != null,
      seller_error: sellerConfigError(),
      attestation_configured: Boolean(attestation),
      trust_free_reader: Boolean(
        process.env.TRUSTGATE_SCORE_API_URL?.trim() &&
          !process.env.TRUSTGATE_SCORE_API_URL.includes("your-"),
      ),
      trust_paid_oracle: isPaidTrustLookupAvailable(),
    },
  });
}