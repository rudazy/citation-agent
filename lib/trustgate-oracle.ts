/**
 * Server-only oracle access for the paid TrustGate lookup.
 *
 * Shared by the MetaMask relay route and the agent-wallet route so both speak to
 * the oracle and cache results the same way. The oracle base URL is read from a
 * server env var and never exposed to the client. Nothing about the recipient or
 * fee is hardcoded; they come from the live 402 challenge.
 */

import {
  getCachedPaidScore,
  setCachedPaidScore,
} from "@/lib/trustgate-paid-store";
import {
  buildOracleUrl,
  encodePaymentHeader,
  parseOracleChallenge,
  parseOracleScore,
  type PaymentProof,
  type ScoreLookupResponse,
  type ScoreSettleResponse,
} from "@/lib/trustgate-paid";

const ORACLE_TIMEOUT_MS = 8000;

/** Server-only oracle base URL. Never exposed to the client. */
export function oracleBase(): string | null {
  const url = process.env.TRUSTGATE_ORACLE_URL?.trim();
  if (!url || url.includes("your-")) return null;
  return url;
}

async function fetchOracle(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORACLE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
    });
    const body: unknown = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function reasonFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.reason === "string") return sanitizeOracleReason(record.reason);
    if (typeof record.error === "string") return sanitizeOracleReason(record.error);
  }
  return sanitizeOracleReason(fallback);
}

function sanitizeOracleReason(reason: string): string {
  if (/rate limit/i.test(reason)) {
    return "Score service is busy. If you already paid, wait a moment and try again.";
  }
  return reason;
}

/**
 * Returns a cached score (no charge) or the live 402 challenge needed to pay.
 */
export async function lookupScore(address: string): Promise<ScoreLookupResponse> {
  const cached = await getCachedPaidScore(address);
  if (cached.hit) return { status: "cached", score: cached.value };

  const base = oracleBase();
  if (!base) return { status: "unconfigured" };

  const result = await fetchOracle(buildOracleUrl(base, address));
  if (!result) return { status: "error", reason: "Oracle unreachable" };

  if (result.status === 200) {
    const score = parseOracleScore(result.body);
    await setCachedPaidScore(address, score);
    return { status: "cached", score };
  }

  if (result.status === 402) {
    const challenge = parseOracleChallenge(result.body);
    if (!challenge) return { status: "error", reason: "Unreadable payment challenge" };
    return { status: "challenge", challenge };
  }

  return {
    status: "error",
    reason: reasonFrom(result.body, `Oracle returned ${result.status}`),
  };
}

/**
 * Relays a payment proof to the oracle and caches the result. The proof
 * references an on-chain payment already made by the user's own wallet (MetaMask
 * or the session agent wallet); the server never holds funds.
 */
export async function settleProof(
  address: string,
  proof: PaymentProof,
): Promise<ScoreSettleResponse> {
  const base = oracleBase();
  if (!base) return { status: "unconfigured" };

  const header = encodePaymentHeader(proof);
  const result = await fetchOracle(buildOracleUrl(base, address), {
    headers: { "X-Payment": header },
  });

  if (!result) {
    // Paid but no result. Cache the failure briefly so a re-view does not re-fire instantly.
    await setCachedPaidScore(address, null);
    return { status: "failed", reason: "Oracle timed out after payment" };
  }

  if (result.status === 200) {
    const score = parseOracleScore(result.body);
    await setCachedPaidScore(address, score);
    if (!score) return { status: "failed", reason: "Oracle returned no score" };
    return { status: "ok", score };
  }

  await setCachedPaidScore(address, null);
  return {
    status: "failed",
    reason: reasonFrom(result.body, `Payment rejected (${result.status})`),
  };
}
