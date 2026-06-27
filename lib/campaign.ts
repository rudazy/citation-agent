/**
 * Campaign launch configuration.
 *
 * Public "since launch" marketplace metrics count only activity at or after this
 * timestamp, so historical test/seed activity is excluded from the public number.
 *
 * Set CAMPAIGN_START_TIMESTAMP (server-side env, ISO 8601 UTC) to the exact launch
 * moment, e.g. 2026-06-28T18:00:00Z. It is read server-side only and never shipped
 * to the client bundle. If unset or invalid, the documented default below is used.
 */

/** Placeholder default; override with CAMPAIGN_START_TIMESTAMP for the real launch. */
export const DEFAULT_CAMPAIGN_START = "2026-06-28T00:00:00Z";

/** Parsed campaign start as a Date. Falls back to DEFAULT_CAMPAIGN_START. */
export function getCampaignStart(): Date {
  const raw = process.env.CAMPAIGN_START_TIMESTAMP?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    console.warn(
      `[campaign] Invalid CAMPAIGN_START_TIMESTAMP="${raw}"; using default ${DEFAULT_CAMPAIGN_START}`,
    );
  }
  return new Date(DEFAULT_CAMPAIGN_START);
}

export function getCampaignStartIso(): string {
  return getCampaignStart().toISOString();
}
