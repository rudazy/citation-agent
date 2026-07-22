/**
 * Signal Cards — structured conviction objects (Phase 1 judgment marketplace).
 * Stored as creator_posts with post_kind = 'signal'; unlock reuses x402 rails.
 */

export const POST_KINDS = ["research", "signal"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const SIGNAL_DIRECTIONS = [
  "long",
  "short",
  "avoid",
  "watch",
  "neutral",
] as const;
export type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];

export const SIGNAL_HORIZONS = ["30d", "90d", "event", "open"] as const;
export type SignalHorizon = (typeof SIGNAL_HORIZONS)[number];

export type SignalFields = {
  direction: SignalDirection;
  confidence: number;
  horizon: SignalHorizon;
  /** Public falsifiability condition (shown on cards). */
  invalidation: string;
};

export function isPostKind(value: unknown): value is PostKind {
  return typeof value === "string" && (POST_KINDS as readonly string[]).includes(value);
}

export function isSignalDirection(value: unknown): value is SignalDirection {
  return (
    typeof value === "string" &&
    (SIGNAL_DIRECTIONS as readonly string[]).includes(value)
  );
}

export function isSignalHorizon(value: unknown): value is SignalHorizon {
  return (
    typeof value === "string" &&
    (SIGNAL_HORIZONS as readonly string[]).includes(value)
  );
}

export function parseSignalConfidence(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 1 && value <= 5) return value;
    return null;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
  }
  return null;
}

/** Validate signal structured fields; returns error message or null. */
export function validateSignalFields(fields: {
  direction?: unknown;
  confidence?: unknown;
  horizon?: unknown;
  invalidation?: unknown;
}): string | null {
  if (!isSignalDirection(fields.direction)) {
    return "Signal direction must be long, short, avoid, watch, or neutral";
  }
  if (parseSignalConfidence(fields.confidence) == null) {
    return "Signal confidence must be an integer from 1 to 5";
  }
  if (!isSignalHorizon(fields.horizon)) {
    return "Signal horizon must be 30d, 90d, event, or open";
  }
  const inv =
    typeof fields.invalidation === "string" ? fields.invalidation.trim() : "";
  if (inv.length < 8) {
    return "Invalidation must be at least 8 characters";
  }
  if (inv.length > 500) {
    return "Invalidation must be 500 characters or fewer";
  }
  return null;
}

export function normalizeSignalFields(fields: {
  direction: SignalDirection;
  confidence: number;
  horizon: SignalHorizon;
  invalidation: string;
}): SignalFields {
  return {
    direction: fields.direction,
    confidence: fields.confidence,
    horizon: fields.horizon,
    invalidation: fields.invalidation.trim(),
  };
}

export const SIGNAL_DIRECTION_LABELS: Record<SignalDirection, string> = {
  long: "Long",
  short: "Short",
  avoid: "Avoid",
  watch: "Watch",
  neutral: "Neutral",
};

export const SIGNAL_HORIZON_LABELS: Record<SignalHorizon, string> = {
  "30d": "30 days",
  "90d": "90 days",
  event: "Event-driven",
  open: "Open",
};

/** Share text for X / YouTube description paste. */
export function buildSignalShareText(params: {
  title: string;
  username: string;
  direction: SignalDirection;
  confidence: number;
  horizon: SignalHorizon;
  url: string;
}): string {
  const dir = SIGNAL_DIRECTION_LABELS[params.direction];
  return [
    `Signal: ${params.title}`,
    `@${params.username} · ${dir} · conf ${params.confidence}/5 · ${SIGNAL_HORIZON_LABELS[params.horizon]}`,
    params.url,
    "— Citation Desk",
  ].join("\n");
}

export function buildDeskShareText(params: {
  username: string;
  url: string;
}): string {
  return [
    `Citation Desk: @${params.username}`,
    "Research, signals, and proof of judgment.",
    params.url,
  ].join("\n");
}
