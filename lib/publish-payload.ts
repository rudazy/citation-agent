import { keccak256, toBytes } from "viem";

export type PublishPayloadInput = {
  title: string;
  subheading: string;
  body: string;
  priceUsdc: string;
  payoutWallet?: string;
  tags?: string[];
  coverImageUrl?: string;
};

/**
 * Stable JSON for publish body binding — field order and tag sort are fixed.
 * cover_image_url joins the digest ONLY when set, so signatures for posts
 * without covers stay byte-identical to the pre-cover format.
 */
export function canonicalPublishPayload(input: PublishPayloadInput): string {
  const tags = [...(input.tags ?? [])]
    .map((tag) => tag.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const payout = input.payoutWallet?.trim() ?? "";
  const cover = input.coverImageUrl?.trim() ?? "";

  return JSON.stringify({
    body: input.body,
    ...(cover ? { cover_image_url: cover } : {}),
    payout_wallet: payout ? payout.toLowerCase() : "",
    price_usdc: input.priceUsdc.trim(),
    subheading: input.subheading.trim(),
    tags,
    title: input.title.trim(),
  });
}

export function publishPayloadDigest(input: PublishPayloadInput): `0x${string}` {
  return keccak256(toBytes(canonicalPublishPayload(input)));
}

export type ArticleImageUploadInput = {
  mime: string;
  size: number;
  filename: string;
};

export function canonicalArticleImageUploadPayload(input: ArticleImageUploadInput): string {
  return JSON.stringify({
    filename: input.filename.trim(),
    mime: input.mime.trim().toLowerCase(),
    size: input.size,
  });
}

export function articleImageUploadDigest(input: ArticleImageUploadInput): `0x${string}` {
  return keccak256(toBytes(canonicalArticleImageUploadPayload(input)));
}

export function articleImageUploadDigestFromFile(file: File): `0x${string}` {
  return articleImageUploadDigest({
    mime: file.type,
    size: file.size,
    filename: file.name,
  });
}

export function publishPayloadFromBody(body: Record<string, unknown>): PublishPayloadInput {
  const tagsRaw = body.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((tag) => String(tag))
    : typeof tagsRaw === "string"
      ? tagsRaw.split(",").map((tag) => tag.trim())
      : undefined;

  return {
    title: String(body.title ?? ""),
    subheading: String(body.subheading ?? ""),
    body: String(body.body ?? ""),
    priceUsdc: String(body.price_usdc ?? body.priceUsdc ?? ""),
    payoutWallet:
      typeof body.payout_wallet === "string"
        ? body.payout_wallet
        : typeof body.payoutWallet === "string"
          ? body.payoutWallet
          : undefined,
    tags,
    coverImageUrl:
      typeof body.cover_image_url === "string"
        ? body.cover_image_url
        : typeof body.coverImageUrl === "string"
          ? body.coverImageUrl
          : undefined,
  };
}