import { getAddress } from "viem";
import { getAdminClient } from "@/lib/supabase/admin";
import { getProfileByUsername } from "@/lib/platform-profile";
import { loadPublishedPostsForProfile } from "@/lib/creator-follows";
import { parsePriceUsdc } from "@/lib/creator-posts";
import { MIN_POST_PRICE_USDC } from "@/lib/creator-post-constants";

export const MIN_TIP_USDC = MIN_POST_PRICE_USDC;
export const MAX_TIP_USDC = 1000;

export function parseTipAmountUsdc(raw: string | null | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const n = parsePriceUsdc(String(raw).trim());
  if (n == null) return null;
  if (n < MIN_TIP_USDC) return null;
  if (n > MAX_TIP_USDC) return null;
  return n;
}

export function formatTipPrice(amount: number): string {
  const s = amount.toFixed(6).replace(/\.?0+$/, "");
  return `$${s || MIN_TIP_USDC}`;
}

/**
 * Resolve where tip USDC should settle: preferred latest post payout wallet,
 * else publisher wallet linked to the profile.
 */
export async function resolveCreatorTipPayee(
  username: string,
): Promise<{ payTo: `0x${string}`; username: string } | null> {
  const profile = await getProfileByUsername(username);
  if (!profile) return null;

  const posts = await loadPublishedPostsForProfile(profile);
  if (posts.length > 0) {
    try {
      return {
        payTo: getAddress(posts[0].payoutWallet),
        username: profile.username,
      };
    } catch {
      // fall through
    }
  }

  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profile_wallets")
    .select("wallet_address, wallet_role")
    .eq("profile_id", profile.id);

  if (error || !data?.length) return null;

  const publisher = data.find((r) => r.wallet_role === "publisher");
  const any = publisher ?? data[0];
  try {
    return {
      payTo: getAddress(String(any.wallet_address)),
      username: profile.username,
    };
  } catch {
    return null;
  }
}
