/**
 * Curator economics — pure share math, safe to import from client components.
 *
 * The database side (ledger writes and reads) lives in lib/unlock-attribution.ts.
 * Keeping the rates and rollups here means UI can quote a rate without pulling
 * the service-role Supabase client into the browser bundle.
 */

export const ATTRIBUTION_SOURCES = ["endorsement", "referral"] as const;
export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

/**
 * Curator share of the unlock price. A stamp carries more weight than a bare
 * link because the endorser publicly attached their reputation to the work.
 */
export const CURATOR_SHARE_RATES: Record<AttributionSource, number> = {
  endorsement: 0.1,
  referral: 0.05,
};

/** USDC precision on Arc — shares round down so credit never exceeds gross. */
export const USDC_DECIMALS = 6;

export type CuratorCreditSummary = {
  attributedUnlocks: number;
  /** Accrued but unpaid credit, fixed to 6 decimals. */
  pendingCreditUsdc: string;
  /** Lifetime attributed credit including anything already settled. */
  totalCreditUsdc: string;
  endorsementUnlocks: number;
  referralUnlocks: number;
};

export const EMPTY_CURATOR_CREDIT: CuratorCreditSummary = {
  attributedUnlocks: 0,
  pendingCreditUsdc: "0.000000",
  totalCreditUsdc: "0.000000",
  endorsementUnlocks: 0,
  referralUnlocks: 0,
};

/** Percent label for UI copy, e.g. "10%". */
export function curatorRateLabel(source: AttributionSource): string {
  return `${Math.round(CURATOR_SHARE_RATES[source] * 100)}%`;
}

/**
 * Curator share of a gross unlock amount, truncated to USDC precision.
 * Truncating (not rounding) keeps curator_share_usdc <= gross_usdc, which the
 * ledger enforces as a check constraint.
 */
export function computeCuratorShareUsdc(
  grossUsdc: string | number,
  source: AttributionSource,
): string {
  const gross = typeof grossUsdc === "number" ? grossUsdc : parseFloat(grossUsdc);
  if (!Number.isFinite(gross) || gross <= 0) return "0.000000";

  const rate = CURATOR_SHARE_RATES[source];
  const scale = 10 ** USDC_DECIMALS;
  const share = Math.floor(gross * rate * scale) / scale;
  return share.toFixed(USDC_DECIMALS);
}

export type AttributionLedgerRow = {
  source: AttributionSource;
  curator_share_usdc: string | number;
  settled_at: string | null;
};

/** Roll ledger rows into the numbers a desk sees. Pure for testability. */
export function summarizeCuratorCredit(
  rows: AttributionLedgerRow[],
): CuratorCreditSummary {
  let pending = 0;
  let total = 0;
  let endorsementUnlocks = 0;
  let referralUnlocks = 0;

  for (const row of rows) {
    const share =
      typeof row.curator_share_usdc === "number"
        ? row.curator_share_usdc
        : parseFloat(row.curator_share_usdc);
    if (!Number.isFinite(share)) continue;

    total += share;
    if (!row.settled_at) pending += share;
    if (row.source === "endorsement") endorsementUnlocks += 1;
    else referralUnlocks += 1;
  }

  return {
    attributedUnlocks: rows.length,
    pendingCreditUsdc: pending.toFixed(USDC_DECIMALS),
    totalCreditUsdc: total.toFixed(USDC_DECIMALS),
    endorsementUnlocks,
    referralUnlocks,
  };
}

/** Trim trailing zeros for compact display of an accrued credit balance. */
export function formatCreditUsdc(amount: string | number): string {
  const value = typeof amount === "number" ? amount : parseFloat(amount);
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value.toFixed(USDC_DECIMALS).replace(/\.?0+$/, "") || "0";
}
