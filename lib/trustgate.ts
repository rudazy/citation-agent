import { isDisplayableTrustScore } from "@/lib/creator-trust";
import { getCachedPaidScore } from "@/lib/trustgate-paid-store";
import {
  isWalletRescoreConfigured,
  rescoreWallet,
} from "@/lib/trustgate-wallet-rescore";
import { coerceTrustScore, normalizeTrustScore } from "@/lib/trustgate-score-parse";

/**
 * TrustGate behavioral score client.
 *
 * Reads an opaque scoring endpoint from TRUSTGATE_SCORE_API_URL and returns a
 * plain { score, tier, confidence } record. The module never throws: any
 * failure (missing URL, timeout, network error, non 2xx, unparseable body)
 * resolves to null so callers degrade gracefully, the same way the app already
 * runs without Supabase. The score is treated as an opaque number. No scoring
 * formula, weight, threshold, or oracle host is hardcoded here.
 */

export type TrustScore = {
  score: number;
  tier: string;
  confidence: number;
};

type CacheEntry = { at: number; value: TrustScore | null };

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_NULL_TTL_MS = 60 * 1000;
/** arc-score on trustgated.xyz often exceeds 4s from serverless regions. */
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_FETCH_CONCURRENCY = 4;

const cache = new Map<string, CacheEntry>();
let missingUrlWarned = false;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw && /^\d+$/.test(raw.trim())) {
    const value = Number(raw.trim());
    if (value > 0) return value;
  }
  return fallback;
}

function cacheTtlMs(): number {
  return readPositiveIntEnv("TRUSTGATE_CACHE_TTL_MS", DEFAULT_TTL_MS);
}

function nullCacheTtlMs(): number {
  return readPositiveIntEnv("TRUSTGATE_NULL_CACHE_TTL_MS", DEFAULT_NULL_TTL_MS);
}

function cacheEntryTtlMs(entry: CacheEntry): number {
  return entry.value === null ? nullCacheTtlMs() : cacheTtlMs();
}

function timeoutMs(): number {
  return readPositiveIntEnv("TRUSTGATE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
}

function fetchConcurrency(): number {
  return readPositiveIntEnv("TRUSTGATE_FETCH_CONCURRENCY", DEFAULT_FETCH_CONCURRENCY);
}

/** Resolve the configured endpoint, or null (warning logged once) when unset. */
function scoreApiUrl(): string | null {
  const url = process.env.TRUSTGATE_SCORE_API_URL?.trim();
  if (!url || url.includes("your-")) {
    if (!missingUrlWarned) {
      console.warn(
        "[trustgate] TRUSTGATE_SCORE_API_URL not set; trust scores disabled (returning null).",
      );
      missingUrlWarned = true;
    }
    return null;
  }
  return url;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** Substitute {address} if present, otherwise append the address as a path segment. */
function buildUrl(base: string, address: string): string {
  if (base.includes("{address}")) {
    return base.replace(/\{address\}/g, encodeURIComponent(address));
  }
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(address)}`;
}

/** Defensive parse: a usable score requires a finite numeric `score`. */
function parseScore(body: unknown): TrustScore | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const raw = coerceTrustScore(record.score);
  if (raw === null) return null;
  const score = normalizeTrustScore(raw);
  const tier = typeof record.tier === "string" ? record.tier : "";
  const confidence =
    typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? record.confidence
      : 0;
  return { score, tier, confidence };
}

async function fetchArcRawScore(url: string): Promise<TrustScore | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return parseScore(body);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Apply TrustGate wallet-rescore so free reads match the oracle playground. */
async function fetchRescoredScore(
  address: string,
  url: string,
): Promise<TrustScore | null> {
  const raw = await fetchArcRawScore(url);
  if (!raw) return null;

  if (!isWalletRescoreConfigured()) {
    return raw;
  }

  try {
    const rescored = await rescoreWallet(raw.score, address);
    return {
      score: rescored.score,
      tier: rescored.tier,
      confidence: 0,
    };
  } catch (err) {
    console.error("[trustgate] wallet-rescore failed:", err);
    return raw;
  }
}

function rememberScore(key: string, value: TrustScore | null): void {
  cache.set(key, { at: Date.now(), value });
}

/**
 * Resolve a single wallet's TrustGate score. Returns null on any failure and
 * caches misses briefly so a slow API is retried without hammering upstream.
 */
export async function getTrustScore(address: string): Promise<TrustScore | null> {
  const key = normalizeAddress(address);
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < cacheEntryTtlMs(cached)) {
    return cached.value;
  }

  const paid = await getCachedPaidScore(key);
  if (paid.hit && paid.value && isDisplayableTrustScore(paid.value)) {
    const value = {
      score: paid.value.score,
      tier: paid.value.tier,
      confidence: 0,
    };
    rememberScore(key, value);
    return value;
  }

  const base = scoreApiUrl();
  if (!base) return null;

  const value = await fetchRescoredScore(key, buildUrl(base, key));
  rememberScore(key, value);
  return value;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * Resolve many wallets in one pass. Addresses are deduped (lowercased) and the
 * cache is respected, so enriching many creators never fires duplicate
 * requests for the same wallet.
 */
export async function getTrustScores(
  addresses: string[],
): Promise<Map<string, TrustScore | null>> {
  const result = new Map<string, TrustScore | null>();
  const unique = [
    ...new Set(addresses.map(normalizeAddress).filter(Boolean)),
  ];

  const scores = await mapWithConcurrency(unique, fetchConcurrency(), (address) =>
    getTrustScore(address),
  );

  unique.forEach((address, index) => {
    result.set(address, scores[index]);
  });

  return result;
}

/** Test-only: reset module state between cases. */
export function clearTrustCache(): void {
  cache.clear();
  missingUrlWarned = false;
}