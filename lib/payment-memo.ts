/**
 * Arc transaction memo helpers for x402 payment reconciliation.
 * @see https://docs.arc.io/arc/concepts/transaction-memos
 */

export const PAYMENT_MEMO_HEADER = "X-Payment-Memo";

const MEMO_MAX_LEN = 120;

export function creatorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function formatCitationPaymentMemo(
  citationId: string,
  creatorName?: string,
): string {
  const royalty = creatorName
    ? ` royalty-to:${creatorSlug(creatorName)}`
    : "";
  return truncateMemo(`citation:${citationId}${royalty} royalty-split`);
}

export function formatMarketplaceHelloMemo(): string {
  return "marketplace:hello-demo x402-gateway";
}

export function formatRoyaltyReserveMemo(
  citationIds: string[],
  creatorName?: string,
): string {
  const ids = citationIds.slice(0, 3).join(",");
  const royalty = creatorName
    ? ` royalty-to:${creatorSlug(creatorName)}`
    : "";
  return truncateMemo(`royalty-reserve:${ids}${royalty}`);
}

/** HTTP headers (X-Payment-Memo) must be Latin-1 / ByteString-safe. */
export function sanitizePaymentMemo(memo: string): string {
  return memo.replace(/[^\x20-\x7E]/g, "");
}

export function truncateMemo(memo: string): string {
  const ascii = sanitizePaymentMemo(memo);
  if (ascii.length <= MEMO_MAX_LEN) return ascii;
  return ascii.slice(0, MEMO_MAX_LEN - 3) + "...";
}

export function readPaymentMemo(req: { headers: { get(name: string): string | null } }): string | null {
  const raw = req.headers.get(PAYMENT_MEMO_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? truncateMemo(trimmed) : null;
}