import { getAddress } from "viem";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  makePostId,
  parsePriceUsdc,
  type CreatorPostRow,
  type PublishPostInput,
  validatePublishInput,
} from "@/lib/creator-posts";
import {
  MAX_POST_BODY_CHARS,
  MIN_POST_PRICE_USDC,
} from "@/lib/creator-post-constants";

export type DraftInput = {
  title?: string;
  subheading?: string;
  body?: string;
  priceUsdc?: string;
  tags?: string[];
  payoutWallet?: string;
  username: string;
  connectedWallet: `0x${string}`;
};

export type DraftSummary = {
  id: string;
  title: string;
  subheading: string;
  body: string;
  priceUsdc: string;
  tags: string[];
  authorName: string;
  payoutWallet: string;
  updatedAt: string;
  createdAt: string;
};

export type DraftResult =
  | { ok: true; draft: DraftSummary }
  | { ok: false; error: string; status: number };

function rowToDraftSummary(row: CreatorPostRow): DraftSummary {
  return {
    id: row.id,
    title: row.title,
    subheading: row.subheading,
    body: row.body,
    priceUsdc: row.price_usdc,
    tags: row.tags ?? [],
    authorName: row.author_name,
    payoutWallet: row.payout_wallet,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

/** Relaxed validation for in-progress drafts (not publish-ready). */
export function validateDraftInput(input: DraftInput): string | null {
  const title = (input.title ?? "").trim();
  const subheading = (input.subheading ?? "").trim();
  const body = (input.body ?? "").trim();

  if (title.length > 200) return "Title must be 200 characters or fewer";
  if (subheading.length > 2000) return "Subheading must be 2000 characters or fewer";
  if (body.length > MAX_POST_BODY_CHARS) {
    return `Body must be ${MAX_POST_BODY_CHARS.toLocaleString()} characters or fewer`;
  }

  if (input.priceUsdc != null && String(input.priceUsdc).trim() !== "") {
    const price = parsePriceUsdc(input.priceUsdc);
    if (price == null) return "Price must be a valid number";
    if (price < MIN_POST_PRICE_USDC) {
      return `Minimum price is ${MIN_POST_PRICE_USDC} USDC`;
    }
  }

  const username = input.username.trim().toLowerCase();
  if (!username) return "Username is required to save a draft";
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return "Username must be 3–24 characters: lowercase letters, numbers, underscores";
  }

  if (input.payoutWallet?.trim()) {
    try {
      getAddress(input.payoutWallet.trim());
    } catch {
      return "Payout wallet must be a valid address";
    }
  }

  return null;
}

export async function listDraftsForWallet(
  wallet: `0x${string}`,
): Promise<DraftSummary[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const normalized = getAddress(wallet).toLowerCase();
  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("status", "draft")
    .eq("connected_wallet", normalized)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[creator-drafts] list failed:", error.message);
    return [];
  }

  return (data as CreatorPostRow[]).map(rowToDraftSummary);
}

export async function getDraftForWallet(
  draftId: string,
  wallet: `0x${string}`,
): Promise<DraftSummary | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const normalized = getAddress(wallet).toLowerCase();
  const { data, error } = await supabase
    .from("creator_posts")
    .select("*")
    .eq("id", draftId)
    .eq("status", "draft")
    .eq("connected_wallet", normalized)
    .maybeSingle();

  if (error || !data) return null;
  return rowToDraftSummary(data as CreatorPostRow);
}

export async function upsertDraft(
  input: DraftInput & { id?: string },
): Promise<DraftResult> {
  const validationError = validateDraftInput(input);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Drafts are not configured", status: 503 };
  }

  const connectedWallet = getAddress(input.connectedWallet);
  const payoutWallet = input.payoutWallet?.trim()
    ? getAddress(input.payoutWallet.trim())
    : connectedWallet;

  const priceRaw = input.priceUsdc?.trim()
    ? parsePriceUsdc(input.priceUsdc)
    : MIN_POST_PRICE_USDC;
  const price = priceRaw ?? MIN_POST_PRICE_USDC;
  const priceUsdc =
    price.toFixed(6).replace(/\.?0+$/, "") || MIN_POST_PRICE_USDC.toString();

  const title = (input.title ?? "").trim() || "Untitled draft";
  const subheading = (input.subheading ?? "").trim() || "Draft teaser";
  // Body can be empty while drafting; store a placeholder to satisfy NOT NULL.
  const body = (input.body ?? "").trim() || " ";
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12);
  const authorName = input.username.trim().toLowerCase();
  const now = new Date().toISOString();

  if (input.id) {
    const existing = await getDraftForWallet(input.id, connectedWallet);
    if (!existing) {
      return { ok: false, error: "Draft not found", status: 404 };
    }

    const { data, error } = await supabase
      .from("creator_posts")
      .update({
        title,
        subheading,
        body,
        price_usdc: priceUsdc,
        tags,
        author_name: authorName,
        payout_wallet: payoutWallet.toLowerCase(),
        updated_at: now,
        published_at: null,
        status: "draft",
      })
      .eq("id", input.id)
      .eq("connected_wallet", connectedWallet.toLowerCase())
      .eq("status", "draft")
      .select("*")
      .single();

    if (error || !data) {
      console.error("[creator-drafts] update failed:", error?.message);
      return { ok: false, error: "Failed to update draft", status: 500 };
    }
    return { ok: true, draft: rowToDraftSummary(data as CreatorPostRow) };
  }

  const id = makePostId(title === "Untitled draft" ? "draft" : title);
  const { data, error } = await supabase
    .from("creator_posts")
    .insert({
      id,
      status: "draft",
      title,
      subheading,
      body,
      price_usdc: priceUsdc,
      tags,
      author_name: authorName,
      connected_wallet: connectedWallet.toLowerCase(),
      payout_wallet: payoutWallet.toLowerCase(),
      published_at: null,
      publish_signed_at: null,
      paid_count: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[creator-drafts] insert failed:", error?.message);
    return { ok: false, error: "Failed to save draft", status: 500 };
  }

  return { ok: true, draft: rowToDraftSummary(data as CreatorPostRow) };
}

export async function deleteDraft(
  draftId: string,
  wallet: `0x${string}`,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Drafts are not configured", status: 503 };
  }

  const normalized = getAddress(wallet).toLowerCase();
  const { data, error } = await supabase
    .from("creator_posts")
    .delete()
    .eq("id", draftId)
    .eq("connected_wallet", normalized)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[creator-drafts] delete failed:", error.message);
    return { ok: false, error: "Failed to delete draft", status: 500 };
  }
  if (!data) {
    return { ok: false, error: "Draft not found", status: 404 };
  }
  return { ok: true };
}

export async function publishDraftById(
  draftId: string,
  input: Omit<PublishPostInput, "connectedWallet"> & {
    connectedWallet: `0x${string}`;
  },
): Promise<
  | { ok: true; post: CreatorPostRow }
  | { ok: false; error: string; status: number }
> {
  const validationError = validatePublishInput(input);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Publishing is not configured", status: 503 };
  }

  const connectedWallet = getAddress(input.connectedWallet);
  const existing = await getDraftForWallet(draftId, connectedWallet);
  if (!existing) {
    return { ok: false, error: "Draft not found", status: 404 };
  }

  const payoutWallet = input.payoutWallet
    ? getAddress(input.payoutWallet)
    : connectedWallet;
  const price = parsePriceUsdc(input.priceUsdc)!;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("creator_posts")
    .update({
      status: "published",
      title: input.title.trim(),
      subheading: input.subheading.trim(),
      body: input.body.trim(),
      price_usdc:
        price.toFixed(6).replace(/\.?0+$/, "") || MIN_POST_PRICE_USDC.toString(),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
      author_name: input.username.trim().toLowerCase(),
      payout_wallet: payoutWallet.toLowerCase(),
      published_at: now,
      publish_signed_at: new Date(input.signedAtMs).toISOString(),
      updated_at: now,
    })
    .eq("id", draftId)
    .eq("connected_wallet", connectedWallet.toLowerCase())
    .eq("status", "draft")
    .select("*")
    .single();

  if (error || !data) {
    console.error("[creator-drafts] publish failed:", error?.message);
    return { ok: false, error: "Failed to publish draft", status: 500 };
  }

  return { ok: true, post: data as CreatorPostRow };
}
