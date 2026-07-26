/**
 * Referral attribution — browser side.
 *
 * The stored code lives in an httpOnly cookie, so it cannot be read from
 * document.cookie. This module owns the round trips and caches the result for
 * the page session: capture once on landing, then read on unlock.
 */

import { normalizeReferralCode } from "@/lib/referral";

const REFERRAL_ENDPOINT = "/api/marketplace/referral";

let cachedRef: string | null = null;
let cacheLoaded = false;
let inFlight: Promise<string | null> | null = null;

/** Test seam — resets the page-session cache. */
export function resetReferralCache(): void {
  cachedRef = null;
  cacheLoaded = false;
  inFlight = null;
}

/**
 * Store a `?ref=` code seen on the current URL. Unknown or malformed codes are
 * discarded server-side; attribution never blocks or alters the page.
 */
export async function captureReferral(code: string | null): Promise<string | null> {
  const ref = normalizeReferralCode(code);
  if (!ref) return getStoredReferral();

  try {
    const res = await fetch(REFERRAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
      credentials: "same-origin",
    });
    if (!res.ok) return getStoredReferral();

    const data = (await res.json()) as { ref?: string | null };
    cachedRef = normalizeReferralCode(data.ref);
    cacheLoaded = true;
    return cachedRef;
  } catch {
    return getStoredReferral();
  }
}

/** Referral code stored for this browser, or null. Cached after first read. */
export async function getStoredReferral(): Promise<string | null> {
  if (cacheLoaded) return cachedRef;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(REFERRAL_ENDPOINT, { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = (await res.json()) as { ref?: string | null };
      return normalizeReferralCode(data.ref);
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  cachedRef = await inFlight;
  cacheLoaded = true;
  return cachedRef;
}

/**
 * Drop a stored code. Used when a curator lands on their own referral link so
 * they never accrue credit against their own reading.
 */
export async function clearReferral(): Promise<void> {
  cachedRef = null;
  cacheLoaded = true;
  try {
    await fetch(REFERRAL_ENDPOINT, {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch {
    // Clearing is best-effort; the cookie expires on its own.
  }
}
