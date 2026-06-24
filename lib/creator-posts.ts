import { randomBytes } from "node:crypto";
import { getAddress } from "viem";
import { getAdminClient } from "@/lib/supabase/admin";
import type { CreatorContent } from "@/lib/citations";
import { MIN_POST_PRICE_USDC } from "@/lib/creator-post-constants";

export { MIN_POST_PRICE_USDC };

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type CreatorPostRow = {
  id: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  /** ISO timestamp from the wallet publish signature (x-publish-timestamp). */
  publish_signed_at: string | null;
  status: string;
  title: string;
  subheading: string;
  body: string;
  price_usdc: string;
  tags: string[];
  author_name: string;
  connected_wallet: string;
  payout_wallet: string;
  paid_count: number;
};

export type PublishPostInput = {
  title: string;
  subheading: string;
  body: string;
  priceUsdc: string;
  tags?: string[];
  authorName?: string;
  payoutWallet?: string;
  connectedWallet: `0x${string}`;
  /** Wallet sign time (ms) — persisted as publish_signed_at for audit. */
  signedAtMs: number;
};

export type PublishPostResult =
  | { ok: true; post: CreatorPostRow }
  | { ok: false; error: string; status: number };

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "post";
}

export function makePostId(title: string): string {
  return `${slugifyTitle(title)}-${randomBytes(4).toString("hex")}`;
}

export function defaultAuthorName(wallet: `0x${string}`): string {
  const lower = wallet.toLowerCase();
  return `Creator ${lower.slice(0, 6)}...${lower.slice(-4)}`;
}

export function parsePriceUsdc(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function validatePublishInput(input: PublishPostInput): string | null {
  const title = input.title.trim();
  const subheading = input.subheading.trim();
  const body = input.body.trim();

  if (title.length < 3) return "Title must be at least 3 characters";
  if (subheading.length < 10) return "Subheading must be at least 10 characters";
  if (body.length < 20) return "Body must be at least 20 characters";

  const price = parsePriceUsdc(input.priceUsdc);
  if (price == null) return "Price must be a valid number";
  if (price < MIN_POST_PRICE_USDC) {
    return `Minimum price is ${MIN_POST_PRICE_USDC} USDC`;
  }

  if (input.payoutWallet) {
    let checksummed: string;
    try {
      checksummed = getAddress(input.payoutWallet);
    } catch {
      return "Payout wallet must be a valid address";
    }
    if (checksummed === ZERO_ADDRESS) {
      return "Payout wallet cannot be the zero address";
    }
  }

  return null;
}

export function rowToCreatorContent(row: CreatorPostRow): CreatorContent {
  const connected = getAddress(row.connected_wallet);
  const payout = getAddress(row.payout_wallet);
  return {
    id: row.id,
    title: row.title,
    author: row.author_name,
    connectedWallet: connected,
    payoutWallet: payout,
    priceUsdc: row.price_usdc,
    tags: row.tags ?? [],
    subheading: row.subheading,
    body: row.body,
    paidCount: row.paid_count ?? 0,
    source: "database",
    publishedAt: row.published_at,
  };
}

export async function loadPublishedPostsFromDb(): Promise<CreatorContent[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[creator-posts] Failed to load posts:", error.message);
    return [];
  }

  return (data as CreatorPostRow[]).map(rowToCreatorContent);
}

export async function getPublishedPostById(id: string): Promise<CreatorContent | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[creator-posts] Failed to load post:", error.message);
    return null;
  }

  if (!data) return null;
  return rowToCreatorContent(data as CreatorPostRow);
}

export async function insertPublishedPost(
  input: PublishPostInput,
): Promise<PublishPostResult> {
  const validationError = validatePublishInput(input);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Publishing is not configured", status: 503 };
  }

  const connectedWallet = getAddress(input.connectedWallet);
  const payoutWallet = input.payoutWallet
    ? getAddress(input.payoutWallet)
    : connectedWallet;

  const price = parsePriceUsdc(input.priceUsdc)!;
  const row: Omit<CreatorPostRow, "created_at" | "updated_at" | "published_at" | "paid_count"> = {
    id: makePostId(input.title),
    status: "published",
    title: input.title.trim(),
    subheading: input.subheading.trim(),
    body: input.body.trim(),
    price_usdc: price.toFixed(6).replace(/\.?0+$/, "") || MIN_POST_PRICE_USDC.toString(),
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
    author_name: input.authorName?.trim() || defaultAuthorName(connectedWallet),
    connected_wallet: connectedWallet.toLowerCase(),
    payout_wallet: payoutWallet.toLowerCase(),
    publish_signed_at: new Date(input.signedAtMs).toISOString(),
  };

  const { data, error } = await supabase
    .from("creator_posts")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("[creator-posts] Insert failed:", error.message);
    return { ok: false, error: "Failed to save post", status: 500 };
  }

  return { ok: true, post: data as CreatorPostRow };
}

export async function incrementPostPaidCount(postId: string): Promise<void> {
  const supabase = getAdminClient();
  if (!supabase) return;

  const { data, error: fetchError } = await supabase
    .from("creator_posts")
    .select("paid_count")
    .eq("id", postId)
    .maybeSingle();

  if (fetchError || !data) return;

  const next = (data.paid_count ?? 0) + 1;
  const { error: updateError } = await supabase
    .from("creator_posts")
    .update({ paid_count: next, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (updateError) {
    console.error("[creator-posts] Failed to bump paid_count:", updateError.message);
  }
}