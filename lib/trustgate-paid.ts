/**
 * Shared helpers for the user-paid TrustGate score lookup (x402).
 *
 * Pure and environment agnostic: parsing, proof encoding, URL building, and the
 * server-side score cache. No wallet, no window, no viem here, so this module is
 * safe to import from the API route, the client module, and tests alike. The
 * separate free reader in lib/trustgate.ts is left untouched.
 *
 * The oracle's 402 challenge supplies recipient and amount at runtime; nothing
 * about the oracle host, recipient, or fee is hardcoded in this file.
 */

export type PaidTrustScore = {
  score: number;
  tier: string;
  recommendation: string;
};

export type OracleChallenge = {
  recipient: `0x${string}`;
  amount: string;
  chainId: number;
  network: string;
};

export type PaymentProof = {
  txHash: string;
  nonce: string;
  from: string;
  network: string;
};

/** GET /api/trustgate/score response (challenge or a cached result). */
export type ScoreLookupResponse =
  | { status: "cached"; score: PaidTrustScore | null }
  | { status: "challenge"; challenge: OracleChallenge }
  | { status: "unconfigured" }
  | { status: "error"; reason: string };

/** POST /api/trustgate/score response (score after payment). */
export type ScoreSettleResponse =
  | { status: "ok"; score: PaidTrustScore }
  | { status: "failed"; reason: string }
  | { status: "unconfigured" }
  | { status: "error"; reason: string };

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

/**
 * Parse the oracle's paid score response. A numeric `score` is required; `tier`
 * and `recommendation` are optional strings. The internal `breakdown` and any
 * other fields are intentionally ignored and never surfaced.
 */
export function parseOracleScore(body: unknown): PaidTrustScore | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const score = record.score;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const tier = typeof record.tier === "string" ? record.tier : "";
  const recommendation =
    typeof record.recommendation === "string" ? record.recommendation : "";
  return { score, tier, recommendation };
}

/** Parse the oracle's 402 challenge into the fields needed to pay. */
export function parseOracleChallenge(body: unknown): OracleChallenge | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (!isAddress(record.recipient)) return null;
  if (typeof record.amount !== "string" || !(parseFloat(record.amount) > 0)) {
    return null;
  }
  if (typeof record.chainId !== "number" || !Number.isFinite(record.chainId)) {
    return null;
  }
  if (typeof record.network !== "string" || record.network.length === 0) {
    return null;
  }
  return {
    recipient: record.recipient,
    amount: record.amount,
    chainId: record.chainId,
    network: record.network,
  };
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Build the payment proof the oracle expects after an on-chain payment. `network`
 * is echoed from the challenge (the oracle only accepts "arc-testnet"); `nonce`
 * is a fresh random value for replay protection unless supplied (tests pass one).
 */
export function buildPaymentProof(params: {
  txHash: string;
  from: string;
  network: string;
  nonce?: string;
}): PaymentProof {
  return {
    txHash: params.txHash,
    nonce: params.nonce ?? randomNonce(),
    from: params.from,
    network: params.network,
  };
}

function toBase64(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(value)));
}

/** Encode the proof as the base64 JSON value of the X-PAYMENT header. */
export function encodePaymentHeader(proof: PaymentProof): string {
  return toBase64(JSON.stringify(proof));
}

/** Substitute {address} or append the address as a path segment. */
export function buildOracleUrl(base: string, address: string): string {
  if (base.includes("{address}")) {
    return base.replace(/\{address\}/g, encodeURIComponent(address));
  }
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(address)}`;
}

// ---- Server-side per-wallet cache (prevents a second charge within TTL) ----

type PaidCacheEntry = { expiresAt: number; value: PaidTrustScore | null };

const cache = new Map<string, PaidCacheEntry>();
const DEFAULT_OK_TTL_MS = 5 * 60 * 1000;
const FAIL_TTL_MS = 30 * 1000;

function okTtlMs(): number {
  const raw = process.env.TRUSTGATE_PAID_CACHE_TTL_MS;
  if (raw && /^\d+$/.test(raw.trim())) {
    const value = Number(raw.trim());
    if (value > 0) return value;
  }
  return DEFAULT_OK_TTL_MS;
}

/** Returns { hit } so a cached null (a prior failure) is distinguishable from a miss. */
export function getCachedPaidScore(address: string): {
  hit: boolean;
  value: PaidTrustScore | null;
} {
  const key = address.trim().toLowerCase();
  const entry = cache.get(key);
  if (!entry) return { hit: false, value: null };
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

/** Cache a result. A null (failure) uses a short TTL so it does not lock out retries for long. */
export function setCachedPaidScore(
  address: string,
  value: PaidTrustScore | null,
): void {
  const key = address.trim().toLowerCase();
  const ttl = value ? okTtlMs() : FAIL_TTL_MS;
  cache.set(key, { expiresAt: Date.now() + ttl, value });
}

/** Test-only: reset the cache between cases. */
export function clearPaidScoreCache(): void {
  cache.clear();
}
