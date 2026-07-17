import { randomBytes } from "node:crypto";
import { getAddress } from "viem";
import { getAdminClient } from "@/lib/supabase/admin";
import type { CreatorContent } from "@/lib/citations";
import {
  MAX_POST_BODY_CHARS,
  MIN_POST_PRICE_USDC,
} from "@/lib/creator-post-constants";

export { MAX_POST_BODY_CHARS, MIN_POST_PRICE_USDC };

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type CreatorPostRow = {
  id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
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
  cover_image_url: string | null;
  edit_version: number;
  last_edited_at: string | null;
};

export type PublishPostInput = {
  title: string;
  subheading: string;
  body: string;
  priceUsdc: string;
  tags?: string[];
  /** Unique platform username — stored as author_name on the post. */
  username: string;
  payoutWallet?: string;
  connectedWallet: `0x${string}`;
  /** Wallet sign time (ms) — persisted as publish_signed_at for audit. */
  signedAtMs: number;
  /** Optional https image URL for catalog cards and OpenGraph. */
  coverImageUrl?: string;
  /** Optional future publish time (ms). Post stays hidden until then. */
  scheduledForMs?: number;
};

/** Furthest a post can be scheduled ahead (90 days). */
export const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

export function validateCoverImageUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return "Cover image URL is too long";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return "Cover image must be an https URL";
  } catch {
    return "Cover image must be a valid https URL";
  }
  return null;
}

export function validateScheduledFor(scheduledForMs: number, nowMs = Date.now()): string | null {
  if (!Number.isFinite(scheduledForMs)) return "Invalid schedule time";
  if (scheduledForMs <= nowMs) return "Scheduled time must be in the future";
  if (scheduledForMs > nowMs + MAX_SCHEDULE_AHEAD_MS) {
    return "Posts can be scheduled at most 90 days ahead";
  }
  return null;
}

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
  if (body.length > MAX_POST_BODY_CHARS) {
    return `Body must be ${MAX_POST_BODY_CHARS.toLocaleString()} characters or fewer (currently ${body.length.toLocaleString()})`;
  }

  const price = parsePriceUsdc(input.priceUsdc);
  if (price == null) return "Price must be a valid number";
  if (price < MIN_POST_PRICE_USDC) {
    return `Minimum price is ${MIN_POST_PRICE_USDC} USDC`;
  }

  const username = input.username.trim().toLowerCase();
  if (!username) return "Username is required";
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return "Username must be 3–24 characters: lowercase letters, numbers, underscores";
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

  if (input.coverImageUrl?.trim()) {
    const coverError = validateCoverImageUrl(input.coverImageUrl);
    if (coverError) return coverError;
  }

  if (input.scheduledForMs != null) {
    const scheduleError = validateScheduledFor(input.scheduledForMs);
    if (scheduleError) return scheduleError;
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
    publishedAt: row.published_at ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    editVersion: row.edit_version ?? 1,
    lastEditedAt: row.last_edited_at ?? undefined,
  };
}

export async function loadPublishedPostsByConnectedWallet(
  wallet: `0x${string}`,
): Promise<CreatorContent[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const normalized = getAddress(wallet).toLowerCase();
  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("status", "published")
    .eq("connected_wallet", normalized)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[creator-posts] Failed to load publisher posts:", error.message);
    return [];
  }

  return (data as CreatorPostRow[]).map(rowToCreatorContent);
}

export async function loadPublishedPostsFromDb(): Promise<CreatorContent[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  // Scheduled posts carry a future published_at and stay hidden until due.
  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
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

  // Same scheduling gate as the catalog: not readable (or buyable) before due time.
  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("[creator-posts] Failed to load post:", error.message);
    return null;
  }

  if (!data) return null;
  return rowToCreatorContent(data as CreatorPostRow);
}

/** Live post ids for build-time route enumeration (generateStaticParams). */
export async function loadPublishedPostIds(limit = 500): Promise<string[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("creator_posts")
    .select("id")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[creator-posts] id enumeration failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => String(row.id));
}

export type PostMeta = {
  title: string;
  subheading: string;
  coverImageUrl: string | null;
};

/**
 * Metadata-only lookup for generateMetadata under Cache Components. The
 * cached metadata scope cannot read the current time, so this query has no
 * scheduling gate: a scheduled post's title/teaser may appear in link
 * previews slightly before it goes live (the body stays gated).
 */
export async function getPostMetaById(id: string): Promise<PostMeta | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("creator_posts")
    .select("title, subheading, cover_image_url")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return {
    title: String(data.title),
    subheading: String(data.subheading),
    coverImageUrl: (data.cover_image_url as string | null) ?? null,
  };
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
  const row: Omit<
    CreatorPostRow,
    "created_at" | "updated_at" | "paid_count" | "edit_version" | "last_edited_at"
  > = {
    id: makePostId(input.title),
    status: "published",
    title: input.title.trim(),
    subheading: input.subheading.trim(),
    body: input.body.trim(),
    price_usdc: price.toFixed(6).replace(/\.?0+$/, "") || MIN_POST_PRICE_USDC.toString(),
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
    author_name: input.username.trim().toLowerCase(),
    connected_wallet: connectedWallet.toLowerCase(),
    payout_wallet: payoutWallet.toLowerCase(),
    publish_signed_at: new Date(input.signedAtMs).toISOString(),
    cover_image_url: input.coverImageUrl?.trim() || null,
    // Scheduled publishing = future published_at; every public read gates on it.
    published_at: new Date(input.scheduledForMs ?? Date.now()).toISOString(),
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

export type UpdatePostInput = {
  postId: string;
  title: string;
  subheading: string;
  body: string;
  priceUsdc: string;
  tags?: string[];
  coverImageUrl?: string;
  changeNote?: string;
  /** Wallet proven by the edit signature — must own the post. */
  connectedWallet: `0x${string}`;
};

export type UpdatePostResult =
  | { ok: true; post: CreatorPostRow }
  | { ok: false; error: string; status: number };

/**
 * Edit a published post. The pre-edit content is snapshotted into
 * post_versions so buyers keep a changelog of the document they paid for;
 * edits never silently rewrite history.
 */
export async function updatePublishedPost(input: UpdatePostInput): Promise<UpdatePostResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Publishing is not configured", status: 503 };
  }

  const { data: existing, error: loadError } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("id", input.postId)
    .maybeSingle();

  if (loadError) {
    console.error("[creator-posts] Edit load failed:", loadError.message);
    return { ok: false, error: "Failed to load post", status: 500 };
  }
  if (!existing) return { ok: false, error: "Post not found", status: 404 };

  const row = existing as CreatorPostRow;
  if (row.connected_wallet.toLowerCase() !== input.connectedWallet.toLowerCase()) {
    return { ok: false, error: "Only the publishing wallet can edit this post", status: 403 };
  }

  const title = input.title.trim();
  const subheading = input.subheading.trim();
  const body = input.body.trim();
  if (title.length < 3) return { ok: false, error: "Title must be at least 3 characters", status: 400 };
  if (subheading.length < 10) {
    return { ok: false, error: "Subheading must be at least 10 characters", status: 400 };
  }
  if (body.length < 20) return { ok: false, error: "Body must be at least 20 characters", status: 400 };
  if (body.length > MAX_POST_BODY_CHARS) {
    return { ok: false, error: `Body must be ${MAX_POST_BODY_CHARS.toLocaleString()} characters or fewer`, status: 400 };
  }
  const price = parsePriceUsdc(input.priceUsdc);
  if (price == null || price < MIN_POST_PRICE_USDC) {
    return { ok: false, error: `Minimum price is ${MIN_POST_PRICE_USDC} USDC`, status: 400 };
  }
  if (input.coverImageUrl?.trim()) {
    const coverError = validateCoverImageUrl(input.coverImageUrl);
    if (coverError) return { ok: false, error: coverError, status: 400 };
  }

  const currentVersion = row.edit_version ?? 1;

  // Snapshot BEFORE applying the edit; unique (post_id, version) makes
  // concurrent double-edits fail closed instead of overwriting a snapshot.
  const { error: versionError } = await supabase.from("post_versions").insert({
    post_id: row.id,
    version: currentVersion,
    title: row.title,
    subheading: row.subheading,
    body: row.body,
    price_usdc: row.price_usdc,
    tags: row.tags ?? [],
    cover_image_url: row.cover_image_url,
    change_note: input.changeNote?.trim().slice(0, 280) || null,
  });
  if (versionError) {
    console.error("[creator-posts] Version snapshot failed:", versionError.message);
    return { ok: false, error: "Could not snapshot the current version — retry", status: 500 };
  }

  const { data: updated, error: updateError } = await supabase
    .from("creator_posts")
    .update({
      title,
      subheading,
      body,
      price_usdc: price.toFixed(6).replace(/\.?0+$/, "") || MIN_POST_PRICE_USDC.toString(),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
      cover_image_url: input.coverImageUrl?.trim() || null,
      edit_version: currentVersion + 1,
      last_edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("edit_version", currentVersion)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    console.error("[creator-posts] Edit update failed:", updateError?.message);
    return { ok: false, error: "Failed to save the edit", status: 500 };
  }

  return { ok: true, post: updated as CreatorPostRow };
}

export type PostVersionMeta = {
  version: number;
  createdAt: string;
  changeNote: string | null;
};

/** Public changelog metadata — never returns historical bodies (paid content). */
export async function listPostVersionMeta(postId: string): Promise<PostVersionMeta[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("post_versions")
    .select("version, created_at, change_note")
    .eq("post_id", postId)
    .order("version", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[creator-posts] Version list failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    version: Number(row.version),
    createdAt: String(row.created_at),
    changeNote: (row.change_note as string | null) ?? null,
  }));
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