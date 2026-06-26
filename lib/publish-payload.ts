import { keccak256, toBytes } from "viem";

export type PublishPayloadInput = {
  title: string;
  subheading: string;
  body: string;
  priceUsdc: string;
  payoutWallet?: string;
  authorName?: string;
  tags?: string[];
};

/** Stable JSON for publish body binding — field order and tag sort are fixed. */
export function canonicalPublishPayload(input: PublishPayloadInput): string {
  const tags = [...(input.tags ?? [])]
    .map((tag) => tag.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const payout = input.payoutWallet?.trim() ?? "";
  const author = input.authorName?.trim() ?? "";

  return JSON.stringify({
    author_name: author,
    body: input.body,
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
    authorName:
      typeof body.author_name === "string"
        ? body.author_name
        : typeof body.authorName === "string"
          ? body.authorName
          : undefined,
    tags,
  };
}