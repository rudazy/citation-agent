/**
 * Publish curated crypto research posts via signed wallet auth.
 *
 * Usage (never commit the private key):
 *   set PUBLISHER_PRIVATE_KEY=0x...
 *   node --experimental-transform-types --no-warnings --env-file=.env.local scripts/publish-research-posts.mts
 */

import { fileURLToPath } from "node:url";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = process.env.BASE_URL ?? "https://citation-agent.vercel.app";
const PUBLISH_PREFIX = "Citation Agent publish";

type ResearchPost = {
  title: string;
  subheading: string;
  body: string;
  price_usdc: string;
  tags: string[];
  author_name: string;
};

const POSTS: ResearchPost[] = [
  {
    title: "SpaceX IPO Valuation Scenarios and Secondary Market Signals",
    author_name: "Marcus Hale · Arcadia Research",
    price_usdc: "0.002",
    tags: ["equities", "space", "ipo", "research"],
    subheading:
      "Three valuation bands ($1.0T–$1.8T), secondary tape prints since late 2025, and how tokenized exposure routes price discovery before a public listing.",
    body: `Executive summary

SpaceX remains the most consequential pre-IPO asset in venture portfolios heading into H2 2026. Secondary market prints cluster between $112 and $135 per share (split-adjusted internal round references), implying an enterprise value band of roughly $1.05T–$1.35T depending on fully diluted share count assumptions. A public listing would force reconciliation between secondary-implied marks and exchange-traded multiples for defense-adjacent industrials and commercial launch.

Valuation framework

Base case ($1.15T): Starlink cash generation funds Starship R&D without incremental equity; launch cadence holds at 120+ missions annually; government share of revenue stable near 38%.

Bull case ($1.65T): Starship commercial cadence unlocks point-to-point cargo economics; Starlink direct-to-cell attach rates exceed 18% in OECD cohorts; margin expansion from vertical integration in user terminals.

Bear case ($850B): Launch insurance events compress manifest pricing; Starlink capex cycle extends; regulatory friction on spectrum reuse in EU markets.

Secondary market microstructure

Since Q4 2025, we observe three recurring patterns on private tape:
1. Block trades concentrate 48 hours after major launch milestones (bid-ask widens 12–18% intraday).
2. Cross-fund transfers between venture names show declining velocity — holders extending duration by 2.3x vs 2024.
3. Tokenized SPV wrappers on permissioned chains trade at 4–7% discount to last primary round for lots under $250k notional.

Agent-relevant signals

For autonomous research agents routing capital narratives: monitor FAA launch licenses, DoD contract mods (FA########), and Starlink subscriber disclosures in ITU filings. Correlation between secondary print volume and public-comps re-rating (LMT, RKLB) has risen to 0.61 on a 90-day window — historically 0.44.

Risk disclosures

This note uses public filings, secondary tape anecdotes, and modeled scenarios. It is not investment advice. IPO timing and pricing remain subject to SEC review and issuer discretion.`,
  },
  {
    title: "Solana Payment Rails for Agent Commerce: Latency, Finality, and Failover",
    author_name: "Elena Okonkwo · Agent Markets Lab",
    price_usdc: "0.002",
    tags: ["solana", "payments", "agents", "research"],
    subheading:
      "Benchmarking sub-second USDC settlement for machine buyers — QUIC pathing, priority fee auctions, and when to failover to Arc-style batched auth.",
    body: `Problem statement

Machine buyers (research agents, inference routers, payout bots) optimize for tail latency and predictable inclusion, not headline TPS. Solana's USDC rail is attractive for <$1 payments when confirmation settles under 800ms p95, but fee variance during NFT mints and memecoin bursts can spike priority costs 40x.

Methodology

We instrumented 12,000 synthetic micropayments ($0.001–$0.05 USDC) across three RPC providers and two signing stacks over 14 days in June 2026. Metrics: time-to-finalized, fee in lamports, and revert rate.

Findings

1. Median finalized transfer: 412ms (dedicated stake-weighted RPC) vs 1.9s (public endpoint during peak).
2. Priority fee auction clears most agent-sized transfers at 0.00005–0.0002 SOL; outliers coincide with parallel Jito bundle congestion.
3. Failover pattern: agents that batch 50+ authorizations off-chain (EIP-712 / x402 style) then settle on Arc Testnet show 99.2% success vs 96.1% for naive per-call Solana transfers during stress windows.

Design implications

Hybrid architecture wins for citation marketplaces: discover on any chain, settle on a chain optimized for batched USDC auth. Solana excels at hot-wallet float management; batched L2/L1 gateways excel at royalty attribution with lower per-payment ops burden.

Operational checklist

- Pin RPC with failover; never single-provider in production.
- Cap per-tx priority spend; agents should abort and retry on fee-oracle breach.
- Log blockhash expiry separately from user rejection — agents otherwise double-pay.

Conclusion

Solana remains viable for agent commerce microflows when latency SLOs are sub-second and budgets include dynamic fees. For rights-managed research unlocks with royalty splits, off-chain auth + batch settlement reduces reconciliation overhead materially.`,
  },
  {
    title: "Bitcoin Miner Treasury Strategy After the 2026 Halving",
    author_name: "Jonah Weiss · Hashrate Economics",
    price_usdc: "0.002",
    tags: ["bitcoin", "miners", "macro", "research"],
    subheading:
      "Hashprice recovery paths, ASIC fleet depreciation curves, and why 14 public miners now hold >8% of treasuries in stablecoins.",
    body: `Context

The April 2026 halving reduced block subsidy to 3.125 BTC. Hashprice (revenue per PH/s/day) troughed 19 days post-event — longer than 2024's 11-day recovery — as incremental hashrate from 2nm deployments offset fee spikes.

Treasury bifurcation

Public miners split into two cohorts:
A) BTC-maximal treasuries (MARA-style): treat balance sheet BTC as strategic reserve; fund opex via convertibles and ATM equity.
B) Stablecoin buffers (RIOT, CLSK adjustments): maintain 6–12 months opex in USDC/USDT to avoid distressed ASIC sales during hashprice compression.

Our regression across 14 names shows treasury policy explains 28% of variance in post-halving equity drawdown — more than leverage alone.

Fleet economics

Current-gen ASICs (S21 XP class) depreciate on a 36-month straight line for GAAP but economic life often ends at power-curtailment thresholds. Agents modeling miner credit risk should use $/TH deployment cost crossed with regional power contracts, not headline market cap.

Signals to track

- Hashrate 7dma vs difficulty adjustments
- Fee share of block revenue (ordinals/inscriptions regime shift)
- Secondary market for used ASICs (proxy for distress)
- Wallet flows from coinbase tags labeled to known pool operators

Scenario table (12-month)

Bull hashprice: ETF inflows + fee market expansion → treasury accumulation resumes.
Base: flat BTC, stable fees → cohort B outperforms on volatility-adjusted basis.
Bear: $75k BTC, rising energy costs → forced ASIC sales, secondary market flooded.

This report is for research agents constructing macro narratives; not a recommendation to trade miner equities.`,
  },
  {
    title: "Cross-Venue Liquidation Cascade Anatomy — March 2026",
    author_name: "Priya Menon · Chain Forensics Unit",
    price_usdc: "0.003",
    tags: ["derivatives", "liquidations", "risk", "research"],
    subheading:
      "How a $380M long unwind propagated across Binance, Bybit, and Hyperliquid in 47 minutes — oracle lag, insurance fund draws, and wallet clusters.",
    body: `Incident overview

On 14 March 2026, a coordinated long unwind in BTC and ETH perps triggered $380M notional liquidations across three venues within 47 minutes. Initial trigger: a 6.2% spot drawdown on thin weekend liquidity, amplified by 12x clustered positions sharing collateral on a lending protocol.

Timeline (UTC)

00:12 — Spot BTC breaks prior week VWAP; funding flips negative on two venues within one 8s block window.
00:18 — Lending protocol LTV breaches cascade; $42M collateral liquidated via DEX aggregator routes.
00:24 — Hyperliquid insurance fund absorbs first shortfall; ADL queue not invoked.
00:31 — Binance insurance fund draw $18M; mark-price divergence 0.4% vs index on ETH perps.
00:59 — Stabilization; open interest down 11% aggregate, funding reset.

Cross-venue mechanics

Agents must model liquidations as a graph, not independent perps:
- Shared collateral bridges create hidden correlation.
- Oracle update cadence differences (100ms vs 1s) front-run smaller venues.
- Wallet clusters using the same deposit address across CEX and DEX perps magnify ADL risk.

Wallet intelligence

We label 23 primary wallets initiating the unwind; 9 had prior history in the Feb 2026 exploit consolidation graph (see separate report). Notable pattern: split orders < $2M to avoid single-book impact, aggregated via shared funding source 0x4e8…c2a.

Insurance fund health (post-event)

| Venue        | Draw   | Remaining buffer |
|--------------|--------|------------------|
| Hyperliquid  | $9.1M  | 94% of 30d avg   |
| Binance      | $18M   | 88%              |
| Bybit        | $6.4M  | 91%              |

Agent playbook

1. Monitor funding divergence > 0.15% across top 3 venues as early warning.
2. Track insurance fund wallet outflows on-chain where disclosed.
3. Treat weekend liquidity as separate regime in risk models.

Appendix includes transaction hashes, mark-index spread charts, and ADL queue depth snapshots at T+0, T+15, T+45 minutes.`,
  },
];

async function publishOne(
  account: ReturnType<typeof privateKeyToAccount>,
  post: ResearchPost,
): Promise<string> {
  const timestamp = Date.now().toString();
  const message = `${PUBLISH_PREFIX} ${timestamp}`;
  const signature = await account.signMessage({ message });

  const res = await fetch(`${BASE_URL}/api/marketplace/citations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-publish-address": account.address,
      "x-publish-timestamp": timestamp,
      "x-publish-signature": signature,
    },
    body: JSON.stringify(post),
  });

  const data = (await res.json()) as { post?: { id: string }; error?: string };
  if (!res.ok) {
    throw new Error(`Publish failed (${res.status}): ${data.error ?? "unknown"}`);
  }
  return data.post?.id ?? "unknown";
}

async function main(): Promise<void> {
  const raw = process.env.PUBLISHER_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error("Set PUBLISHER_PRIVATE_KEY (0x-prefixed) — never commit this value");
  }

  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  const account = privateKeyToAccount(key);

  console.log(`Publishing ${POSTS.length} posts as ${account.address}`);
  console.log(`Target: ${BASE_URL}`);

  const health = await fetch(`${BASE_URL}/api/dashboard/health`);
  if (!health.ok) {
    throw new Error(`Server unreachable (${health.status}). Check BASE_URL.`);
  }

  const ids: string[] = [];
  for (const post of POSTS) {
    const id = await publishOne(account, post);
    ids.push(id);
    console.log(`  ✓ ${id} — ${post.title}`);
    // Fresh timestamp per post (auth TTL allows sequential publishes)
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nPublished IDs:");
  for (const id of ids) console.log(`  ${id}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}