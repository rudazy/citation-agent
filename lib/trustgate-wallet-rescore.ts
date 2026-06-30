import "server-only";

// Post-processing layer for the wallet oracle proxy. Mirrors the caps,
// bot detectors, and tier bands defined in oracle/token-scoring.ts so the
// public proxy is the final authority on wallet scores regardless of what
// the upstream oracle returns.

const ARCSCAN_API_URL =
  process.env.ARCSCAN_BASE?.trim() || "https://testnet.arcscan.app";
const ARC_RPC_URL =
  process.env.ARC_TESTNET_RPC?.trim() || "https://rpc.testnet.arc.network";

// Sensitive scoring constants are sourced from server-only environment
// variables (SCORING_WALLET_ prefix, no NEXT_PUBLIC_) so the thresholds, caps,
// and gates never ship to the client. Each read is wrapped in Number().
// Fallbacks are deliberately neutral, NOT the real production values: caps
// default to 100 (no cap), penalties default to 0 (no effect), detection
// thresholds default to extremes that make the flag never fire, and the
// HIGH_ELITE / perfect gate mins default to extremes that keep the gate
// unreachable. A missing-env deploy therefore degrades to obviously-neutered
// scoring (no caps, no flags, elite gates closed) rather than leaking or
// silently faking the real values.
const BOT_FLAG_PENALTY = Number(process.env.SCORING_WALLET_BOT_FLAG_PENALTY ?? 0);
const VELOCITY_TXS_PER_HOUR = Number(process.env.SCORING_WALLET_VELOCITY_TXS_PER_HOUR ?? 999999);
const INTERVAL_PATTERN_MIN_SAMPLE = Number(process.env.SCORING_WALLET_INTERVAL_PATTERN_MIN_SAMPLE ?? 999999);
const INTERVAL_PATTERN_TOLERANCE = Number(process.env.SCORING_WALLET_INTERVAL_PATTERN_TOLERANCE ?? 0);
const INTERVAL_PATTERN_DOMINANCE = Number(process.env.SCORING_WALLET_INTERVAL_PATTERN_DOMINANCE ?? 999999);
const SELF_INTERACTION_THRESHOLD = Number(process.env.SCORING_WALLET_SELF_INTERACTION_THRESHOLD ?? 999999);
// Clean-history is a youth-of-wallet signal: a brand-new wallet with hundreds
// of perfect txs is suspicious; a mature wallet with a clean record is just
// careful. Only flag when all three hold: high volume, zero failures, fresh.
// Neutral fallback closes the flag (min-txs unreachable, max-age 0).
const CLEAN_HISTORY_MIN_TXS = Number(process.env.SCORING_WALLET_CLEAN_HISTORY_MIN_TXS ?? 999999);
const CLEAN_HISTORY_MAX_AGE_DAYS = Number(process.env.SCORING_WALLET_CLEAN_HISTORY_MAX_AGE_DAYS ?? 0);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SIGNALS_TTL_MS = 5 * 60 * 1000;
const TX_PAGES = 5;

// Hard caps and tier gates. Caps default to 100 (no cap); gate mins default to
// 999999 (unreachable, so a missing-env deploy keeps every elite/perfect gate
// closed rather than accidentally open).
const HARD_CAP = Number(process.env.SCORING_WALLET_HARD_CAP ?? 100);
const NON_ELITE_CAP = Number(process.env.SCORING_WALLET_NON_ELITE_CAP ?? 100);
const NON_PERFECT_CAP = Number(process.env.SCORING_WALLET_NON_PERFECT_CAP ?? 100);

// Fresh-wallet gate. Neutral fallback of 0 means the gate never triggers
// (walletAgeDays < 0 and txCount < 0 are both impossible).
const FRESH_MAX_AGE_DAYS = Number(process.env.SCORING_WALLET_FRESH_MAX_AGE_DAYS ?? 0);
const FRESH_MIN_TXS = Number(process.env.SCORING_WALLET_FRESH_MIN_TXS ?? 0);

// Two-or-more bot flags hard-cap rule. Neutral fallback of 999999 makes the
// count-based hard cap unreachable.
const BOT_FLAG_HARDCAP_COUNT = Number(process.env.SCORING_WALLET_BOT_FLAG_HARDCAP_COUNT ?? 999999);

// HIGH_ELITE gate thresholds (all must hold simultaneously).
const HIGH_ELITE_MIN_DEPLOYMENTS = Number(process.env.SCORING_WALLET_HIGH_ELITE_MIN_DEPLOYMENTS ?? 999999);
const HIGH_ELITE_QUALITY_DEPLOYMENTS = Number(process.env.SCORING_WALLET_HIGH_ELITE_QUALITY_DEPLOYMENTS ?? 999999); // deployments with 100+ independent interactors
const HIGH_ELITE_MIN_ACTIVE_MONTHS = Number(process.env.SCORING_WALLET_HIGH_ELITE_MIN_ACTIVE_MONTHS ?? 999999);
const HIGH_ELITE_MIN_CATEGORIES = Number(process.env.SCORING_WALLET_HIGH_ELITE_MIN_CATEGORIES ?? 999999);
const HIGH_ELITE_MIN_AGE_DAYS = Number(process.env.SCORING_WALLET_HIGH_ELITE_MIN_AGE_DAYS ?? 999999);
const HIGH_ELITE_MIN_TXS = Number(process.env.SCORING_WALLET_HIGH_ELITE_MIN_TXS ?? 999999);

// Score-of-100 gate thresholds (all HIGH_ELITE conditions plus these).
const PERFECT_MIN_DEPLOYMENTS = Number(process.env.SCORING_WALLET_PERFECT_MIN_DEPLOYMENTS ?? 999999);
const PERFECT_QUALITY_DEPLOYMENTS = Number(process.env.SCORING_WALLET_PERFECT_QUALITY_DEPLOYMENTS ?? 999999); // deployments with 500+ independent interactors
const PERFECT_MIN_TXS = Number(process.env.SCORING_WALLET_PERFECT_MIN_TXS ?? 999999);
const PERFECT_MIN_AGE_DAYS = Number(process.env.SCORING_WALLET_PERFECT_MIN_AGE_DAYS ?? 999999);

// Confidence thresholds. HIGH thresholds default to 999999 (HIGH unreachable)
// and LOW thresholds to 0 (LOW never triggers), so a missing-env deploy reports
// a neutral MEDIUM confidence everywhere.
const CONFIDENCE_HIGH_AGE_DAYS = Number(process.env.SCORING_WALLET_CONFIDENCE_HIGH_AGE_DAYS ?? 999999);
const CONFIDENCE_HIGH_TXS = Number(process.env.SCORING_WALLET_CONFIDENCE_HIGH_TXS ?? 999999);
const CONFIDENCE_HIGH_QUALITY_DEPLOYMENTS = Number(process.env.SCORING_WALLET_CONFIDENCE_HIGH_QUALITY_DEPLOYMENTS ?? 999999);
const CONFIDENCE_LOW_AGE_DAYS = Number(process.env.SCORING_WALLET_CONFIDENCE_LOW_AGE_DAYS ?? 0);
const CONFIDENCE_LOW_TXS = Number(process.env.SCORING_WALLET_CONFIDENCE_LOW_TXS ?? 0);

export type WalletTier = "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";
export type WalletRecommendation =
  | "BLOCKED"
  | "TIME_LOCKED"
  | "INSTANT"
  | "INSTANT_PRIORITY";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

type BotFlag =
  | "velocity"
  | "interval-pattern"
  | "self-interaction"
  | "clean-history";

interface Signals {
  deployments: number;
  walletAgeDays: number;
  txCount: number;
  botFlags: BotFlag[];
  // Number of distinct calendar months with at least one outgoing tx. Derived
  // from the tx sample timestamps.
  activeMonths: number;
  // Deployment-quality signals. These require an oracle wallet-graph (which
  // wallets are independent of the deployer, and per-deployment interactor
  // counts). The oracle does not expose that yet, so these fall back to 0 and
  // the HIGH_ELITE / perfect gates stay conservatively closed until the data
  // is available. See gatherSignals.
  deploymentsWithQualityInteractors: number; // deployments with 100+ independent interactors
  deploymentsWith500Interactors: number; // deployments with 500+ independent interactors
  categoryDiversity: number; // distinct contract categories deployed
}

interface SignalsCacheEntry {
  expiresAt: number;
  signals: Signals;
}

const signalsCache: Map<string, SignalsCacheEntry> = new Map();

interface ArcscanTx {
  result?: string;
  status?: string;
  timestamp?: string;
  from?: { hash?: string } | null;
  to?: { hash?: string } | null;
  created_contract?: { hash?: string } | null;
}

interface ArcscanTxPage {
  items?: ArcscanTx[];
  next_page_params?: Record<string, unknown>;
}

async function arcscanGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ARCSCAN_API_URL}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function rpcCall(
  method: string,
  params: unknown[]
): Promise<string | null> {
  try {
    const res = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };
    if (data.error) return null;
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function fetchTxCount(address: string): Promise<number> {
  // Prefer the Arcscan counters endpoint (consistent with the rest of the
  // pipeline). Fall back to RPC nonce if Arcscan is unavailable.
  const counters = await arcscanGet<{ transactions_count?: string | number }>(
    `/api/v2/addresses/${address}/counters`
  );
  if (counters && counters.transactions_count !== undefined) {
    const n = Number(counters.transactions_count);
    if (Number.isFinite(n)) return n;
  }
  const hex = await rpcCall("eth_getTransactionCount", [address, "latest"]);
  if (!hex) return 0;
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

async function fetchWalletTxs(address: string): Promise<ArcscanTx[]> {
  // Outgoing-only txs — these are what the wallet itself initiated, which is
  // the relevant signal for velocity / pattern / self-interaction / clean
  // history (we want to evaluate the wallet's own behavior, not noise from
  // unsolicited inbound transfers).
  const out: ArcscanTx[] = [];
  let nextParams = "filter=from";
  for (let page = 0; page < TX_PAGES; page++) {
    const path = `/api/v2/addresses/${address}/transactions?${nextParams}`;
    const data = await arcscanGet<ArcscanTxPage>(path);
    if (!data) break;
    const items = data.items ?? [];
    out.push(...items);
    if (!data.next_page_params || items.length === 0) break;
    const tuples: [string, string][] = Object.entries(data.next_page_params).map(
      ([k, v]) => [k, String(v)]
    );
    tuples.push(["filter", "from"]);
    nextParams = new URLSearchParams(tuples).toString();
  }
  return out;
}

function countDeployments(txs: ArcscanTx[]): number {
  let n = 0;
  for (const tx of txs) {
    if (tx.created_contract?.hash) n++;
  }
  return n;
}

function walletAgeDaysFrom(txs: ArcscanTx[]): number {
  // Use the oldest outgoing tx in our sample as the wallet age proxy.
  // If we couldn't fetch any txs, age is 0 and the wallet is treated as fresh.
  let oldest = Number.POSITIVE_INFINITY;
  for (const tx of txs) {
    if (!tx.timestamp) continue;
    const t = Date.parse(tx.timestamp);
    if (Number.isNaN(t)) continue;
    if (t < oldest) oldest = t;
  }
  if (!Number.isFinite(oldest)) return 0;
  return Math.max(0, (Date.now() - oldest) / DAY_MS);
}

function countActiveMonths(txs: ArcscanTx[]): number {
  // Distinct YYYY-MM buckets across the outgoing tx sample. A proxy for how
  // long the wallet has been genuinely active, not just how old it is.
  const months = new Set<string>();
  for (const tx of txs) {
    if (!tx.timestamp) continue;
    const t = Date.parse(tx.timestamp);
    if (Number.isNaN(t)) continue;
    const d = new Date(t);
    months.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
  }
  return months.size;
}

// --- bot detectors (apply the same logic as token-scoring.ts) ---

function detectVelocity(txs: ArcscanTx[]): boolean {
  if (txs.length < VELOCITY_TXS_PER_HOUR) return false;
  const ms = txs
    .map((t) => (t.timestamp ? Date.parse(t.timestamp) : NaN))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  let left = 0;
  let max = 0;
  for (let right = 0; right < ms.length; right++) {
    while (ms[right] - ms[left] > HOUR_MS) left++;
    const count = right - left + 1;
    if (count > max) max = count;
  }
  return max > VELOCITY_TXS_PER_HOUR;
}

function detectIntervalPattern(txs: ArcscanTx[]): boolean {
  if (txs.length < INTERVAL_PATTERN_MIN_SAMPLE + 1) return false;
  const sorted = txs
    .map((t) => (t.timestamp ? Date.parse(t.timestamp) : NaN))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 0) intervals.push(d);
  }
  if (intervals.length < INTERVAL_PATTERN_MIN_SAMPLE) return false;
  let bestCluster = 0;
  for (const ref of intervals) {
    let count = 0;
    for (const v of intervals) {
      if (Math.abs(v - ref) / ref <= INTERVAL_PATTERN_TOLERANCE) count++;
    }
    if (count > bestCluster) bestCluster = count;
  }
  return bestCluster / intervals.length >= INTERVAL_PATTERN_DOMINANCE;
}

function detectSelfInteraction(
  txs: ArcscanTx[],
  walletLower: string
): boolean {
  let n = 0;
  for (const tx of txs) {
    const from = tx.from?.hash?.toLowerCase();
    const to = tx.to?.hash?.toLowerCase();
    if (from === walletLower && to === walletLower) n++;
  }
  return n >= SELF_INTERACTION_THRESHOLD;
}

function detectCleanHistoryManipulation(
  txs: ArcscanTx[],
  walletAgeDays: number
): boolean {
  if (txs.length <= CLEAN_HISTORY_MIN_TXS) return false;
  if (walletAgeDays >= CLEAN_HISTORY_MAX_AGE_DAYS) return false;
  for (const tx of txs) {
    const result = (tx.result ?? "").toLowerCase();
    const status = (tx.status ?? "").toLowerCase();
    const failed =
      result === "error" ||
      result === "failed" ||
      result === "reverted" ||
      status === "error" ||
      status === "failed" ||
      status === "0";
    if (failed) return false;
  }
  return true;
}

// --- formula ---

export function tierFor(score: number): WalletTier {
  if (score < 40) return "LOW";
  if (score < 60) return "MEDIUM";
  if (score < 80) return "HIGH";
  return "HIGH_ELITE";
}

export function recommendationFor(score: number): WalletRecommendation {
  if (score === 0) return "BLOCKED";
  if (score < 60) return "TIME_LOCKED";
  if (score < 80) return "INSTANT";
  return "INSTANT_PRIORITY";
}

// RescoreResult is the internal shape. `confidence` is computed and returned
// here for internal use and frontend display, but MUST be stripped before the
// public API response — the public oracle proxy only forwards score/tier/
// recommendation (see api/oracle/[address]/route.ts).
export interface RescoreResult {
  score: number;
  tier: WalletTier;
  recommendation: WalletRecommendation;
  confidence: Confidence;
  /** Why the score is not in the next tier up. Empty when no cap applies. */
  limitations: string[];
}

function computeConfidence(signals: Signals): Confidence {
  const { walletAgeDays, txCount, deploymentsWithQualityInteractors } = signals;
  if (
    walletAgeDays >= CONFIDENCE_HIGH_AGE_DAYS &&
    txCount >= CONFIDENCE_HIGH_TXS &&
    deploymentsWithQualityInteractors >= CONFIDENCE_HIGH_QUALITY_DEPLOYMENTS
  ) {
    return "HIGH";
  }
  if (walletAgeDays < CONFIDENCE_LOW_AGE_DAYS || txCount < CONFIDENCE_LOW_TXS) {
    return "LOW";
  }
  return "MEDIUM";
}

function computeLimitations(
  signals: Signals,
  opts: {
    botHardCap: boolean;
    isFresh: boolean;
    highEliteOk: boolean;
    perfectOk: boolean;
    tier: WalletTier;
    score: number;
  }
): string[] {
  const { deployments, walletAgeDays, txCount, botFlags, activeMonths } =
    signals;
  const { botHardCap, isFresh, highEliteOk, perfectOk, tier, score } = opts;
  const out: string[] = [];

  if (tier === "HIGH_ELITE" && score >= 100) return out;

  if (botHardCap || botFlags.length > 0) {
    out.push("Behavioral anomaly detected");
  }
  if (isFresh) {
    out.push("Young wallet");
  }
  if (!highEliteOk) {
    if (deployments < HIGH_ELITE_MIN_DEPLOYMENTS) {
      out.push("Limited deployment history");
    }
    if (txCount < HIGH_ELITE_MIN_TXS) {
      out.push("Sparse onchain activity");
    }
    if (walletAgeDays < HIGH_ELITE_MIN_AGE_DAYS) {
      out.push("Insufficient wallet age");
    }
    if (activeMonths < HIGH_ELITE_MIN_ACTIVE_MONTHS) {
      out.push("Limited activity spread");
    }
    if (signals.categoryDiversity < HIGH_ELITE_MIN_CATEGORIES) {
      out.push("Narrow protocol participation");
    }
    if (
      signals.deploymentsWithQualityInteractors <
      HIGH_ELITE_QUALITY_DEPLOYMENTS
    ) {
      out.push("Deployments lack independent usage");
    }
  } else if (!perfectOk && tier === "HIGH_ELITE") {
    out.push("Elite tier reached; perfect score requires sustained top-tier history");
  }

  return [...new Set(out)].slice(0, 4);
}

function applyFormula(rawScore: number, signals: Signals): RescoreResult {
  const {
    deployments,
    walletAgeDays,
    txCount,
    botFlags,
    activeMonths,
    deploymentsWithQualityInteractors,
    deploymentsWith500Interactors,
    categoryDiversity,
  } = signals;

  // Penalty always applies, even for a single isolated signal.
  let raw = rawScore - botFlags.length * BOT_FLAG_PENALTY;
  if (raw < 0) raw = 0;

  let cap = 100;

  // Bot hard caps. A single isolated signal (other than self-interaction) is a
  // penalty only — no hard cap. Two or more signals, OR self-interaction
  // (signal 3) alone, hard-cap at 59 with no exceptions.
  const selfInteraction = botFlags.includes("self-interaction");
  const botHardCap = botFlags.length >= BOT_FLAG_HARDCAP_COUNT || selfInteraction;
  if (botHardCap) cap = Math.min(cap, HARD_CAP);

  // Fresh-wallet hard cap.
  const isFresh = walletAgeDays < FRESH_MAX_AGE_DAYS || txCount < FRESH_MIN_TXS;
  if (isFresh) cap = Math.min(cap, HARD_CAP);

  // HIGH_ELITE gate: every condition must hold simultaneously. Under 25
  // deployments alone makes HIGH_ELITE unreachable (cap 79). The quality,
  // calendar-spread, and category-diversity sub-conditions depend on oracle
  // wallet-graph data that is not exposed yet, so they fall back to 0 in
  // gatherSignals and keep the elite gate conservatively closed until then.
  const highEliteOk =
    deployments >= HIGH_ELITE_MIN_DEPLOYMENTS &&
    deploymentsWithQualityInteractors >= HIGH_ELITE_QUALITY_DEPLOYMENTS &&
    !botHardCap &&
    activeMonths >= HIGH_ELITE_MIN_ACTIVE_MONTHS &&
    categoryDiversity >= HIGH_ELITE_MIN_CATEGORIES &&
    walletAgeDays >= HIGH_ELITE_MIN_AGE_DAYS &&
    txCount >= HIGH_ELITE_MIN_TXS;
  if (!highEliteOk) cap = Math.min(cap, NON_ELITE_CAP);

  // Score-of-100 gate: all HIGH_ELITE conditions plus the perfect thresholds.
  const perfectOk =
    highEliteOk &&
    deployments >= PERFECT_MIN_DEPLOYMENTS &&
    deploymentsWith500Interactors >= PERFECT_QUALITY_DEPLOYMENTS &&
    txCount >= PERFECT_MIN_TXS &&
    walletAgeDays >= PERFECT_MIN_AGE_DAYS;
  if (!perfectOk) cap = Math.min(cap, NON_PERFECT_CAP);

  let score = Math.round(raw);
  if (score > cap) score = cap;
  if (score < 0) score = 0;

  const tier = tierFor(score);

  return {
    score,
    tier,
    recommendation: recommendationFor(score),
    confidence: computeConfidence(signals),
    limitations: computeLimitations(signals, {
      botHardCap,
      isFresh,
      highEliteOk,
      perfectOk,
      tier,
      score,
    }),
  };
}

async function gatherSignals(address: string): Promise<Signals> {
  const lower = address.toLowerCase();
  const cached = signalsCache.get(lower);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.signals;
  }

  const [txCount, walletTxs] = await Promise.all([
    fetchTxCount(address),
    fetchWalletTxs(address),
  ]);

  const deployments = countDeployments(walletTxs);
  const walletAgeDays = walletAgeDaysFrom(walletTxs);
  const activeMonths = countActiveMonths(walletTxs);

  const botFlags: BotFlag[] = [];
  if (detectVelocity(walletTxs)) botFlags.push("velocity");
  if (detectIntervalPattern(walletTxs)) botFlags.push("interval-pattern");
  if (detectSelfInteraction(walletTxs, lower)) botFlags.push("self-interaction");
  if (detectCleanHistoryManipulation(walletTxs, walletAgeDays))
    botFlags.push("clean-history");

  // TODO: derive these from oracle wallet-graph data when available — per
  // deployment, count only interactors with no on-chain link to the deployer
  // (exclude deployer-linked wallets), and classify deployed contracts into
  // distinct categories. Until the oracle exposes that graph, fall back to 0,
  // which keeps the HIGH_ELITE / perfect gates closed rather than guessing.
  const deploymentsWithQualityInteractors = 0;
  const deploymentsWith500Interactors = 0;
  const categoryDiversity = 0;

  const signals: Signals = {
    deployments,
    walletAgeDays,
    txCount,
    botFlags,
    activeMonths,
    deploymentsWithQualityInteractors,
    deploymentsWith500Interactors,
    categoryDiversity,
  };

  signalsCache.set(lower, {
    expiresAt: Date.now() + SIGNALS_TTL_MS,
    signals,
  });

  console.log(
    `[wallet-rescore] ${address} deployments=${signals.deployments} ` +
      `ageDays=${signals.walletAgeDays.toFixed(1)} txs=${signals.txCount} ` +
      `flags=[${signals.botFlags.join(",")}]`
  );

  return signals;
}

export async function rescoreWallet(
  rawScore: number,
  address: string
): Promise<RescoreResult> {
  const signals = await gatherSignals(address);
  return applyFormula(rawScore, signals);
}
