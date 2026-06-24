/**
 * Confirms production Supabase has pending migrations applied and publish_signed_at works.
 *
 *   node --experimental-transform-types --no-warnings --env-file=.env.local scripts/verify-production-migrations.mts
 */

import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getAddress } from "viem";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { error: trustCacheError } = await supabase
    .from("paid_trust_cache")
    .select("wallet_address")
    .limit(1);

  if (trustCacheError) {
    console.error("paid_trust_cache check failed:", trustCacheError.message);
    process.exit(1);
  }
  console.log("OK paid_trust_cache table exists and is readable");

  const testId = `migration-smoke-${Date.now().toString(36)}`;
  const signedAt = new Date().toISOString();
  const wallet = getAddress("0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62");

  const { data: inserted, error: insertError } = await supabase
    .from("creator_posts")
    .insert({
      id: testId,
      status: "published",
      title: "Migration smoke test",
      subheading: "Temporary row — deleted immediately after verify",
      body: "Smoke test body for publish_signed_at column verification.",
      price_usdc: "0.001",
      tags: ["smoke"],
      author_name: "Migration verify",
      connected_wallet: wallet.toLowerCase(),
      payout_wallet: wallet.toLowerCase(),
      publish_signed_at: signedAt,
    })
    .select("id, publish_signed_at")
    .single();

  if (insertError) {
    console.error("creator_posts publish_signed_at insert failed:", insertError.message);
    process.exit(1);
  }

  if (!inserted?.publish_signed_at) {
    console.error("publish_signed_at was null after insert");
    process.exit(1);
  }

  console.log("OK publish_signed_at write/read:", inserted.publish_signed_at);

  const { error: deleteError } = await supabase.from("creator_posts").delete().eq("id", testId);
  if (deleteError) {
    console.error("cleanup delete failed (remove manually):", testId, deleteError.message);
    process.exit(1);
  }
  console.log("OK smoke row deleted");
  console.log("Production schema ready for onboarding.");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}