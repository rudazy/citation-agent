/**
 * Generate curated crypto research seed markdown files for content/creators/.
 *
 *   node --experimental-transform-types --no-warnings scripts/generate-research-seeds.mts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "content", "creators");

const SKIP_IDS = new Set([
  "hyperliquid-market-share",
  "berachain-liquidity",
  "whale-accumulation-xyz",
  "exploit-wallet-investigation",
  "stablecoin-yield-q3-2026",
  "sui-ecosystem-report",
]);

type SeedPost = {
  id: string;
  title: string;
  author: string;
  author_wallet: string;
  price_usdc: "0.001" | "0.002" | "0.003";
  tags: string[];
  subheading: string;
  body: string;
};

const POSTS: SeedPost[] = [
  // DeFi (3)
  {
    id: "uniswap-v4-hooks",
    title: "Uniswap v4 Hooks: Fee Routing, MEV Capture, and LP Economics",
    author: "Marcus Hale · Arcadia Research",
    author_wallet: "0x8f3Cf7ad23Cd3CaDbD9735AFf9582D5C8B5b8b8b",
    price_usdc: "0.002",
    tags: ["defi", "uniswap", "hooks", "amm", "research"],
    subheading:
      "Hook-enabled pool factories, dynamic fee surfaces, and how custom logic reshapes LP returns versus v3 concentrated liquidity through H1 2026.",
    body: `Uniswap v4's singleton PoolManager architecture externalizes pool logic into hooks — contracts invoked at lifecycle boundaries (before/after swap, liquidity add/remove, donate). By June 2026, over 340 hook-enabled pools have deployed on mainnet, with cumulative swap volume exceeding $4.2B. The design shifts competitive advantage from curve parameterization to hook-level microstructure engineering.

Our framework segments hooks into four functional classes: (1) dynamic fee adjusters responding to volatility or inventory skew, (2) MEV redistribution modules that internalize arb surplus to LPs, (3) limit-order and TWAP executors replacing off-chain routers, and (4) compliance or allowlist gates for institutional sub-pools. Dynamic fee hooks on ETH/USDC pairs show 12–18 bps tighter effective spreads during high-vol windows versus static-fee v3 equivalents, measured across 90-day rolling windows.

LP economics diverge materially by hook type. MEV-capture hooks (e.g., Bunni-style surplus routing) improve realized APR by 2.1–4.7% annualized on blue-chip pairs, but introduce smart-contract dependency risk — one audited hook upgrade in April 2026 caused a 6-hour liquidity freeze affecting $38M TVL. Concentrated liquidity hooks that auto-rebalance positions reduce impermanent loss variance by ~22% in backtests, at the cost of higher gas amortization on L1.

Risk notes: hook contracts are unaudited by default unless pool deployers commission reviews; composability with flash loans creates novel reentrancy surfaces; singleton architecture concentrates upgrade governance in the PoolManager owner multisig. Agents monitoring v4 should track hook address allowlists, fee tier migrations, and the ratio of routed volume through custom versus vanilla pools.`,
  },
  {
    id: "aave-v4-liquidations",
    title: "Aave v4 Liquidation Mechanics: Hub-Spoke Architecture and Bad Debt Containment",
    author: "Dr. Yuki Tanaka · DeFi Risk Consortium",
    author_wallet: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    price_usdc: "0.003",
    tags: ["defi", "aave", "liquidations", "lending", "research"],
    subheading:
      "Hub-spoke isolation, liquidation bonus curves, and simulated bad-debt paths under 40% ETH drawdown scenarios for Q3 2026 stress planning.",
    body: `Aave v4 introduces a hub-and-spoke liquidity model where a central Liquidity Hub aggregates collateral across spoke markets, enabling cross-collateral efficiency while preserving risk isolation via spoke-level debt ceilings. Liquidation logic remains health-factor driven, but v4 adds configurable liquidation close factors per asset class and a gradual liquidation mode for large positions (> $500k notional) to reduce market impact.

Historical liquidation data from Aave v3 mainnet (Jan 2024–Jun 2026) shows 94.2% of liquidations execute within 5% of the liquidation threshold, with median bonus captured by liquidators at 4.8%. Simulating v4's gradual mode on the same corpus reduces average slippage cost to borrowers by 31% on positions exceeding $1M, at the expense of longer underwater windows — a trade-off that matters for correlated-asset drawdowns.

Our stress framework models a 40% ETH price shock with 25% stablecoin depeg secondary event. Under v3 parameters, projected bad debt accumulation peaks at $142M across ETH-correlated collateral pools. v4 spoke isolation contains this to $67M when stablecoin spokes are capped at 15% hub share, assuming liquidator participation rates hold at historical medians. The critical sensitivity is liquidator capital availability during gas spikes; Base and Arbitrum spokes show 2.3x faster liquidation completion than mainnet in identical scenarios.

Risk disclosures: hub concentration creates a single point of governance failure; oracle latency during bridge events has caused false liquidations in testnet drills; gradual liquidation may delay price discovery for distressed collateral. Monitor Aave governance proposals on spoke debt ceilings, liquidation bonus adjustments, and emergency pause modules.`,
  },
  {
    id: "curve-crvusd",
    title: "Curve crvUSD Peg Dynamics: LLAMMA Bands, PegKeepers, and Liquidity Fragmentation",
    author: "Elena Vasquez · Stablecoin Analytics",
    author_wallet: "0x9c4F24Ff0A13F2a6B3c7d8e9f0a1b2c3d4e5f6a7",
    price_usdc: "0.001",
    tags: ["defi", "curve", "crvusd", "stablecoins", "research"],
    subheading:
      "LLAMMA rebalancing bands, PegKeeper inventory flows, and crvUSD market share versus GHO and FRAX on Ethereum mainnet.",
    body: `crvUSD maintains its dollar peg through the LLAMMA (Lending-Liquidating AMM Algorithm) — a soft liquidation mechanism that continuously rebalances collateral into crvUSD as prices decline, rather than triggering discrete liquidation events. As of June 2026, crvUSD circulating supply stands at $168M, with 72% backed by wstETH and sfrxETH collateral types. The PegKeeper contracts absorb peg deviations by minting or burning crvUSD against Curve stableswap pools.

Band width configuration is the primary peg stability lever. Narrow bands (1–2%) provide tighter peg adherence (median deviation 3 bps over 30 days) but increase rebalancing frequency and gas costs for borrowers. Wide bands (4–6%) reduce borrower UX friction but exhibit tail deviations up to 28 bps during ETH volatility spikes exceeding 8% daily moves. Our monitoring shows optimal band selection correlates with collateral asset volatility quartile, not absolute TVL.

Competitive positioning versus GHO ($312M supply) and legacy FRAX ($648M) reveals crvUSD's niche: deep integration with Curve gauge emissions drives 41% of borrow demand from yield farmers looping staked ETH positions. However, liquidity fragmentation across crvUSD/USDC pools on Ethereum, Arbitrum, and Optimism creates 5–15 bps cross-venue arb opportunities that PegKeepers partially close.

Key risks: PegKeeper inventory limits can exhaust during sustained one-sided pressure; wstETH basis blowouts propagate directly into crvUSD collateral ratios; gauge emission reductions would compress borrow demand. Track crvUSD premium/discount on secondary markets, PegKeeper utilization rates, and LLAMMA band migration proposals in Curve governance.`,
  },

  // Stablecoins (3)
  {
    id: "usdc-usdt-reserves",
    title: "USDC vs USDT Reserve Composition: Attestation Lags and Counterparty Concentration",
    author: "Priya Menon · Chain Forensics Unit",
    author_wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    price_usdc: "0.002",
    tags: ["stablecoins", "usdc", "usdt", "reserves", "research"],
    subheading:
      "Circle vs Tether attestation cadence, custodial bank concentration, and onchain redemption flow asymmetries through Q2 2026.",
    body: `USDC and USDT collectively anchor ~92% of onchain dollar liquidity, yet their reserve architectures diverge in ways that matter for institutional treasury allocation. Circle publishes weekly attestations via Deloitte, with ~88% of reserves in Treasury bills and overnight repo as of the May 2026 report. Tether's quarterly CRR reports show ~76% in Treasury bills, money market funds, and secured loans, with the remainder in bitcoin, gold, and other assets per their disclosed categories.

Attestation lag is the operative risk variable. USDC's weekly cycle means maximum information staleness of 7 days; USDT's quarterly cycle implies up to 90 days between verified snapshots. During the March 2025 regional banking stress, USDC's same-day transparency allowed redemption-driven supply contraction of 12% within 48 hours, while USDT maintained peg but exhibited secondary market discounts to 992 bps on Curve pools for 6 hours. Onchain monitoring of Circle's USDC_TOKEN_MINTER and Tether's treasury addresses shows asymmetric redemption velocity: USDC burns correlate 0.89 with attestation dates, USDT burns show weaker correlation (0.34) with quarterly releases.

Counterparty concentration presents a second-order risk. Circle holds reserves across BNY Mellon, Customers Bank, and Goldman Sachs custody — three institutions representing 94% of disclosed cash equivalents. Tether's custodial spread is wider but less granular in public disclosures. For agent systems routing large stablecoin inventory, we recommend tracking: (1) attestation publication latency, (2) net mint/burn velocity by chain, (3) secondary market premium/discount on DEX pools exceeding $10M depth.

This analysis does not constitute audit opinion or investment advice. Reserve compositions change with issuer policy; agents should verify primary attestation documents before capital allocation decisions.`,
  },
  {
    id: "eurc-corridors",
    title: "EURC Cross-Border Corridors: SEPA Integration and FX Basis on Ethereum L2s",
    author: "Thomas Bergmann · European Digital Finance Lab",
    author_wallet: "0x5aAeb6053F3E94C9b9C4b6C8e0F1a2B3c4D5e6F7",
    price_usdc: "0.001",
    tags: ["stablecoins", "eurc", "euro", "payments", "research"],
    subheading:
      "Circle EURC mint/redemption rails, SEPA settlement latency, and EUR/USD basis spreads across Base and Arbitrum DEX liquidity.",
    body: `EURC (Euro Coin) is Circle's euro-denominated stablecoin, issued under the same regulatory framework as USDC via Circle Mint and supported on Ethereum, Solana, Avalanche, Base, and Arbitrum. Circulating supply reached €186M by June 2026, with 58% deployed on L2s — primarily Base (€72M) and Arbitrum (€41M). The primary use case shift from speculative FX trading to B2B payment corridors is measurable: SEPA-integrated mint accounts show 3.2x growth in batch redemption requests since Q4 2025.

Cross-border corridor analysis reveals three dominant flow patterns: (1) EU exporter → US importer via EURC→USDC atomic swaps on Uniswap v3, (2) payroll distribution to contractor wallets on Base with local off-ramp via regulated VASPs, (3) DeFi collateral posting where EURC serves as euro-denominated margin on perpetual venues. Median swap slippage for €50k EURC→USDC on Base is 4 bps; on Ethereum mainnet the same trade costs 11 bps due to pool depth concentration.

FX basis risk emerges when EURC trades off peg against ECB reference rates. Our 180-day study shows median deviation of 2 bps, with tail events (ECB surprise rate decisions) pushing deviations to 18 bps for 4–8 hour windows. L2 liquidity is thinner than USDC equivalents — EURC/USDC pool depth on Base is $12M versus $340M for USDC/USDT, amplifying basis volatility during European trading hours.

Operational risks: SEPA settlement is T+1 for fiat redemption, creating overnight inventory risk for market makers; MiCA compliance requirements may restrict issuer services by jurisdiction; thin L2 pools increase sandwich attack surface for large corridor trades. Monitor Circle's EURC attestation reports, SEPA corridor volume on Base/Arbitrum bridges, and ECB rate decision calendars for basis event planning.`,
  },
  {
    id: "synthetic-dollar-latency",
    title: "Synthetic Dollar Latency: Mint-Burn Propagation Across Bridge and CEX Rails",
    author: "James Okoro · Payments Infrastructure Group",
    author_wallet: "0x3f5CE5FBFe3E9eeC27D2dC4e8b0C8C8C8C8C8C8C",
    price_usdc: "0.003",
    tags: ["stablecoins", "synthetic", "latency", "bridges", "research"],
    subheading:
      "End-to-end mint-to-wallet latency benchmarks for USDC, USDT, and DAI across native, bridge, and CEX deposit paths in June 2026.",
    body: `Synthetic dollar latency — the time from fiat or collateral initiation to spendable onchain balance — determines whether stablecoins function as payment rails or merely store-of-value instruments. We instrumented 2,400 mint and bridge events across six paths (Circle native mint, Tether Tron→Ethereum bridge, Maker DSR mint, Wormhole USDC, Circle CCTP, and CEX deposit) over 21 days in June 2026.

Native Circle mint (institutional API) shows p50 latency of 4.2 minutes and p99 of 38 minutes, dominated by banking wire settlement rather than onchain confirmation. CCTP burns on Ethereum and mints on Base complete in p50 18 seconds and p99 94 seconds — the fastest trust-minimized path for USDC. Tron USDT→Ethereum via official bridge averages 11 minutes p50 but exhibits 4.2% failure rate requiring manual intervention during Tron network congestion. CEX deposit paths (Coinbase, Kraken) range from 12 minutes to 6 hours depending on withdrawal queue depth and chain selection.

Latency variance directly impacts agent commerce economics. Machine buyers with sub-$1 payment SLAs should prefer CCTP or native L2 USDC; treasury operations moving >$1M benefit from native mint despite wire delay, avoiding bridge smart-contract risk. DAI mint via Spark protocol is fastest among crypto-native paths (p50 12 seconds on Ethereum) but carries peg deviation risk during governance events.

Risk factors: bridge contract upgrades can halt transfers for 24–72 hours; CEX withdrawal suspensions during volatility are uncorrelated with onchain congestion; synthetic dollar latency metrics degrade during US market holidays when banking rails pause. Agents should maintain failover inventory on at least two chains and monitor Circle/Tether status pages plus bridge guardian health dashboards.`,
  },

  // L2s (3)
  {
    id: "base-sequencer-revenue",
    title: "Base Sequencer Revenue: L2 Fee Markets and Coinbase Distribution Advantage",
    author: "Rachel Kim · L2 Economics Desk",
    author_wallet: "0xAb5801a7D398351b0be34c8a7c4b1F8Ae60a24d",
    price_usdc: "0.002",
    tags: ["l2", "base", "sequencer", "revenue", "research"],
    subheading:
      "Sequencer fee capture, L1 data cost pass-through, and Base transaction share versus Arbitrum and Optimism in H1 2026.",
    body: `Base, launched by Coinbase on the OP Stack, has emerged as the highest-throughput Ethereum L2 by daily active addresses, averaging 1.2M DAA in June 2026 versus Arbitrum's 680K and Optimism's 410K. Sequencer revenue — the spread between user-paid L2 fees and L1 calldata/blob costs — is the primary economic metric for rollup sustainability. Base generated approximately $38M in cumulative sequencer revenue through H1 2026, with monthly run-rate accelerating to $8.2M in June.

Revenue decomposition follows a consistent pattern: 62% of sequencer income derives from DeFi transactions (swaps, lending, bridging), 21% from social and consumer apps (Farcaster integrations, onchain gaming), and 17% from infrastructure (account abstraction, paymaster sponsorship). Base's integration with Coinbase Smart Wallet reduces onboarding friction — 34% of new addresses in Q2 2026 originated from Coinbase custody, creating a distribution moat that competitors cannot replicate without equivalent CEX partnerships.

L1 cost pass-through efficiency improved materially after EIP-4844 blob adoption. Base's median blob submission cost per batch fell from $0.18 to $0.04 between March and June 2026, expanding sequencer margins by ~28%. However, fee market competition intensified: Base reduced minimum L2 gas prices twice in Q2, compressing per-transaction revenue while growing volume 3.1x.

Risks: sequencer centralization under Coinbase creates regulatory surface area; Optimism Superchain revenue-sharing obligations may compress margins post-2027; consumer app dominance makes revenue vulnerable to narrative cycles. Track Base sequencer wallet outflows, blob utilization rates, and OP Stack governance proposals affecting profit-sharing terms.`,
  },
  {
    id: "arbitrum-stylus",
    title: "Arbitrum Stylus: WASM Contracts, Gas Benchmarks, and EVM Interoperability",
    author: "Dr. Kenji Watanabe · Rollup Engineering Lab",
    author_wallet: "0x2B5AD5Ac479D9A864Ce3A184A2A6f934E38A2F84",
    price_usdc: "0.001",
    tags: ["l2", "arbitrum", "stylus", "wasm", "research"],
    subheading:
      "Stylus VM gas efficiency versus Solidity on Arbitrum One, language support roadmap, and production deployment inventory as of June 2026.",
    body: `Arbitrum Stylus, activated on mainnet in March 2024, enables smart contracts written in Rust, C, C++, and other WASM-compatible languages to execute alongside traditional EVM bytecode. The Stylus VM uses Arbitrum's ArbOS to schedule WASM contracts with bidirectional calling — EVM contracts can invoke Stylus and vice versa without bridge overhead. By June 2026, 47 production Stylus contracts are deployed, concentrated in high-compute domains: onchain order matching, ZK proof verification helpers, and game physics engines.

Gas benchmarking reveals structural advantages for compute-heavy workloads. A token swap routing algorithm compiled to Rust executes at 8.3x lower gas cost than equivalent Solidity on identical input sets. Cryptographic operations (Ed25519 verify, SHA-256 batch hashing) show 12–15x improvement. However, simple storage read/write patterns favor EVM due to Stylus cold-start overhead — contracts with < 5,000 gas per invocation should remain on Solidity unless batching amortizes WASM activation cost.

Interoperability is production-ready but developer tooling remains immature. The Stylus SDK (Rust) version 0.9.x supports #[public] exports and storage macros, but debugging infrastructure lags Hardhat/Foundry ergonomics. Three audited template repositories (orderbook, AMM, voting) serve as reference implementations; custom deployments require independent security review.

Risk notes: WASM contract vulnerabilities differ from Solidity patterns (memory safety vs reentrancy); ArbOS upgrade path could alter gas pricing; limited auditor familiarity with Stylus expands time-to-production. Monitor Arbitrum governance forum for Stylus gas schedule changes, new language SDK releases, and mainnet WASM contract audit publications.`,
  },
  {
    id: "optimism-superchain",
    title: "Optimism Superchain: Shared Sequencing, Revenue Allocation, and Interop Timeline",
    author: "Sofia Andersson · OP Collective Research",
    author_wallet: "0x4Ddc2D193948948D9943521C53e8aa9fdf58A463",
    price_usdc: "0.003",
    tags: ["l2", "optimism", "superchain", "interop", "research"],
    subheading:
      "Superchain registry membership, sequencer revenue split mechanics, and cross-chain messaging readiness across OP Stack chains.",
    body: `The Optimism Superchain envisions a network of interoperable L2s sharing security, sequencing infrastructure, and governance through the OP Stack. As of June 2026, the Superchain registry includes Base, OP Mainnet, World Chain, Zora, Mode, and six additional chains in various production stages, collectively securing $12.4B in TVL and processing 4.8M daily transactions. Revenue allocation follows the OP Collective's governance-approved formula: 20% to the Optimism Foundation, 15% to public goods funding, and 65% retained by individual chains.

Shared sequencing — the transition from per-chain sequencers to a unified ordering layer — remains the critical path dependency for true interop. The testnet phase (Interop Devnet 0) demonstrated 2.1-second cross-chain message passing between OP Mainnet and Base testnets in controlled benchmarks. Production deployment is targeted for Q4 2026, contingent on fault-proof maturity and sequencer decentralization milestones. Until shared sequencing ships, cross-chain UX relies on third-party bridges with attendant trust assumptions.

Economic interdependence creates both synergies and contagion vectors. Base's revenue dominance (62% of Superchain sequencer income) subsidizes smaller chains through the public goods allocation, but also concentrates governance influence. Chains that fail to meet minimum decentralization criteria risk registry delisting — a governance lever untested in production.

Monitor OP Collective governance votes on revenue split adjustments, shared sequencer testnet metrics, fault-proof activation on OP Mainnet, and new Superchain member onboarding cadence. Agents routing cross-chain liquidity should model bridge dependency until native interop reaches production SLA guarantees.`,
  },

  // Sui (2)
  {
    id: "sui-move-package-governance",
    title: "Sui Move Package Governance: Upgrade Policies and Dependency Risk Graphs",
    author: "Anika Sharma · Move Security Collective",
    author_wallet: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    price_usdc: "0.002",
    tags: ["sui", "move", "governance", "packages", "research"],
    subheading:
      "Sui package upgrade policies (immutable, compatible, additive), dependency tree analysis for top 50 DeFi packages, and governance incident review.",
    body: `Sui's Move package system supports three upgrade policies set at publish time: immutable (no upgrades permitted), compatible (additive changes only — new functions and types, no breaking modifications), and additive with deprecation windows. Unlike Ethereum's proxy patterns, upgrade authority is encoded in the package's UpgradeCap object, transferable and governable via onchain mechanisms. As of June 2026, 2,847 packages are published on Sui mainnet; 38% are immutable, 51% compatible, and 11% retain unrestricted upgrade rights.

Dependency risk analysis of the top 50 DeFi packages by TVL reveals concerning concentration. The Sui Framework (sui::) is a universal dependency, but secondary concentration exists around three community libraries: movemate (18 dependents), sui_decimal (12 dependents), and cetus_clmm (9 dependents). A breaking upgrade to any compatible package propagates risk to all dependents unless maintainers pin version constraints — a practice only 34% of top packages enforce explicitly.

The February 2026 Navi Protocol governance incident illustrates the failure mode: a compatible upgrade to the lending core introduced a rounding change that reduced collateral factors by 0.3% for three asset types. The change was governance-approved but dependency-unaudited — three downstream vault protocols experienced unexpected liquidation threshold shifts within 6 hours. Post-incident, Sui Foundation proposed optional upgrade notification events; adoption remains voluntary.

Risk framework for agents: verify package upgrade policy before depositing funds, monitor UpgradeCap ownership transfers, and map transitive dependencies to assess blast radius. Immutable packages eliminate upgrade risk but also foreclose bug fixes — 62% of immutable packages are token standards or single-purpose utilities, not complex DeFi logic.`,
  },
  {
    id: "sui-deepbook-clob-depth",
    title: "Sui DeepBook CLOB Depth: Maker-Taker Flows and Cross-Protocol Liquidity",
    author: "Liam O'Connell · Onchain Markets Unit",
    author_wallet: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    price_usdc: "0.001",
    tags: ["sui", "deepbook", "clob", "liquidity", "research"],
    subheading:
      "DeepBook V2 order book depth metrics, maker rebate economics, and SUI/USDC spread comparison versus CEX benchmarks.",
    body: `DeepBook is Sui's native central limit order book (CLOB), providing protocol-level spot trading infrastructure that DeFi protocols can integrate via composable order placement. DeepBook V2, launched in January 2026, introduced maker rebates (0.02% rebate vs 0.04% taker fee), flash loan integration for atomic arbitrage, and permissionless market creation for whitelisted asset pairs. Daily volume averaged $42M in June 2026, with SUI/USDC representing 68% of flow.

Order book depth analysis at ±10 bps from mid-price shows $1.8M cumulative depth for SUI/USDC — sufficient for trades up to $180k with < 10 bps slippage, but materially thinner than Binance SUI/USDT ($14M at equivalent bands). Maker-taker ratio has stabilized at 1.4:1 after rebate introduction, up from 0.7:1 in V1, indicating improved market-making participation. Three market-making firms account for 61% of resting liquidity, creating concentration risk similar to CEX order book dynamics.

Cross-protocol integration is DeepBook's strategic differentiator. Cetus CLMM routes large orders through DeepBook for price discovery before on-chain settlement, reducing CLMM impermanent loss exposure. Turbos and Aftermath protocols consume DeepBook mid-prices as oracle inputs. This composability creates feedback loops: DeepBook depth attracts CLMM volume, which attracts more market makers to DeepBook.

Risks: market maker concentration enables manipulation of oracle feeds derived from mid-price; permissionless market creation could introduce low-liquidity pairs used for price spoofing; SUI price volatility directly impacts book depth as market makers widen spreads. Monitor DeepBook V2 volume-weighted spread, top maker address inventory changes, and new market creation events for emerging asset pairs.`,
  },

  // Solana (2)
  {
    id: "jupiter-route-toxicity",
    title: "Jupiter Route Toxicity: Slippage Surfaces and Sandwich Exposure on Solana DEX Aggregator",
    author: "Diego Morales · Solana MEV Lab",
    author_wallet: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    price_usdc: "0.002",
    tags: ["solana", "jupiter", "mev", "dex", "research"],
    subheading:
      "Route-level toxicity scoring across Jupiter V6, sandwich attack rates by pool type, and Jito bundle co-location effects on execution quality.",
    body: `Jupiter aggregates liquidity across 20+ Solana DEXs, routing ~$1.8B daily swap volume as of June 2026. Route toxicity — the degree to which a swap path is exploitable by sandwich attackers — varies dramatically by pool composition, hop count, and execution timing relative to Jito block engine slots. We analyzed 840,000 Jupiter swaps exceeding $1,000 notional over 14 days, scoring each route for realized slippage versus simulated fair-price execution.

Single-hop routes through Orca Whirlpools and Raydium CLMMs exhibit lowest toxicity (sandwich rate 2.1%, median excess slippage 3 bps). Multi-hop routes crossing Phoenix CLOB and Meteora DLMM pools show 8.7% sandwich rate and 14 bps median excess slippage. Routes involving low-liquidity meme token pairs exceed 22% sandwich rate, with excess slippage reaching 89 bps at p99. Jupiter's built-in slippage tolerance default (0.5%) is exploited systematically on volatile pairs — users accepting > 0.3% tolerance face 4.2x higher sandwich probability.

Jito bundle co-location materially alters execution quality. Swaps submitted via Jito bundles with tip ≥ 0.001 SOL experience 67% lower sandwich rate, as bundle ordering protects against intra-block frontrunning. However, bundle tips transfer surplus to validators rather than users, creating a pay-for-protection dynamic that disadvantages retail flow.

Mitigation recommendations for agents: set slippage tolerance to minimum viable for pair liquidity, prefer direct routes over multi-hop when price impact is comparable, use Jito bundles for trades > $10k notional on volatile pairs, and monitor Jupiter's route simulation API for pre-execution toxicity scores. Track Solana DEX pool creation velocity and Jito tip auction clearing prices as leading indicators of MEV environment intensity.`,
  },
  {
    id: "marinade-vs-jito-staking",
    title: "Marinade vs Jito Staking: LST Premium, MEV Revenue Split, and Validator Decentralization",
    author: "Elena Okonkwo · Agent Markets Lab",
    author_wallet: "0x1111111111111111111111111111111111111111",
    price_usdc: "0.003",
    tags: ["solana", "staking", "marinade", "jito", "research"],
    subheading:
      "mSOL vs JitoSOL yield decomposition, MEV tip distribution, and validator concentration metrics for Solana liquid staking tokens.",
    body: `Liquid staking on Solana is dominated by two protocols: Marinade (mSOL, $1.2B TVL) and Jito (JitoSOL, $2.1B TVL). Both issue liquid staking tokens (LSTs) representing delegated SOL, but differ fundamentally in MEV strategy and revenue distribution. Marinade offers native staking and liquid staking with optional MEV-enabled validator selection; Jito mandates MEV tip capture via its block engine, distributing tips pro-rata to JitoSOL holders.

Yield decomposition for June 2026 (annualized): base staking rewards average 7.2% for both LSTs. JitoSOL captures an additional 1.8–2.4% from MEV tips, while mSOL MEV-enabled tranches add 0.9–1.3%. The JitoSOL premium reflects structural MEV participation — Jito validators running the block engine capture tips that Marinade's default validator set partially foregoes. However, JitoSOL trades at a 0.12% discount to NAV on secondary markets versus mSOL's 0.04% discount, partially offsetting yield advantage.

Validator decentralization metrics reveal trade-offs. Marinade delegates across 120+ validators with maximum 3% stake concentration per validator. Jito's validator set is smaller (38 active) with top-5 validators holding 28% of JitoSOL stake — concentration that creates slashing correlation risk. Nakamoto coefficient for JitoSOL is 12 versus mSOL's 23.

Risks: Solana slashing events (rare but catastrophic for LST NAV); Jito MEV tip volatility — tips fell 62% during April 2026 memecoin lull; regulatory classification of MEV revenue as securities income in some jurisdictions. Monitor LST premium/discount on Jupiter, validator uptime and skip rates, and Solana foundation staking yield adjustments post SIMD proposals.`,
  },

  // Wallet investigations (2)
  {
    id: "wintermute-rotation",
    title: "Wintermute Wallet Rotation: Address Cluster Analysis and Exchange Deposit Patterns",
    author: "Priya Menon · Chain Forensics Unit",
    author_wallet: "0x28C6c06298d514Db089934071355E5743bf21d60",
    price_usdc: "0.002",
    tags: ["wallets", "wintermute", "forensics", "market-making", "research"],
    subheading:
      "Identified Wintermute operational wallet clusters, 90-day rotation cadence, and exchange deposit routing across Binance, Coinbase, and OKX.",
    body: `Wintermute, one of the largest crypto market makers, maintains operational security through systematic wallet rotation — periodically retiring funded addresses and migrating inventory to fresh clusters. Using heuristic clustering (co-spend analysis, timing correlation, DEX interaction fingerprints, and known label cross-references), we identified 14 active operational clusters across Ethereum, Arbitrum, and Solana as of June 2026, controlling an estimated $380M in aggregate inventory.

Rotation cadence follows a roughly 90-day cycle for high-activity clusters, with acceleration to 30-day cycles during elevated exploit risk periods (observed post-Lazarus attribution campaigns in Q1 2026). The rotation pattern is not random: new clusters are pre-funded via intermediary hops through privacy-preserving bridges (Railgun, 0x relayers) before receiving inventory from retiring clusters. Average hop count between old and new cluster is 4.2 intermediary addresses over 72 hours.

Exchange deposit routing reveals operational preferences: 52% of Wintermute-labeled flows terminate at Binance hot wallets, 28% at Coinbase, 12% at OKX, with remaining 8% distributed across Kraken and Bybit. Deposit timing clusters around UTC 06:00–10:00 (Asian market close overlap), suggesting deliberate minimization of market impact during inventory rebalancing. Notable anomaly: a 14,200 ETH movement on June 3, 2026, routed through three fresh addresses before Binance deposit — consistent with OTC desk settlement rather than open market sale.

This investigation uses public onchain data and heuristic attribution; labels carry confidence intervals, not certainty. Wintermute has not confirmed cluster mappings. Agents should treat attribution as probabilistic and avoid automated enforcement actions based solely on heuristic labels.`,
  },
  {
    id: "jump-deposit-clusters",
    title: "Jump Trading Deposit Clusters: Cross-Chain Inventory Movements and Bridge Preferences",
    author: "Marcus Hale · Arcadia Research",
    author_wallet: "0x47ac0Fb4F2D84898e4D9E7fe4ce6B6925D8C8809",
    price_usdc: "0.001",
    tags: ["wallets", "jump", "forensics", "bridges", "research"],
    subheading:
      "Jump Crypto-associated deposit clusters on Ethereum and Solana, bridge route preferences, and inventory concentration by asset class.",
    body: `Jump Trading's crypto arm (Jump Crypto) operates one of the most sophisticated onchain inventory management systems in the industry. Our cluster analysis, combining Arkham-labeled seed addresses, Wormhole guardian co-participation, and DEX market-making fingerprints, maps 9 primary deposit clusters active between March and June 2026 across Ethereum, Solana, Base, and Arbitrum.

Bridge preference data reveals strategic routing: Jump utilizes Wormhole for 44% of cross-chain USDC transfers, Circle CCTP for 31%, and native exchange withdrawals for 25%. Wormhole preference correlates with Solana-destination flows — Jump's Solana market-making inventory is replenished almost exclusively via Wormhole from Ethereum treasury clusters. CCTP usage concentrates on Base and Arbitrum routes where Wormhole latency (p99 4.2 minutes) is operationally unacceptable for arbitrage windows measured in seconds.

Inventory concentration by asset class (estimated from cluster balance snapshots): USDC/USDT stablecoins 42%, ETH/WETH 28%, SOL 18%, governance tokens (ARB, OP, JUP) 8%, other 4%. Stablecoin concentration increased 12 percentage points since Q4 2025, consistent with broader market-maker defensive positioning ahead of volatility events. Three clusters exhibited simultaneous 8-figure USDC movements on June 12, 2026 — correlating with the ETH flash crash to $2,180 and subsequent recovery, suggesting inventory deployment for liquidity provision during dislocation.

Attribution confidence varies by cluster: Ethereum clusters A and B carry high confidence (0.91, 0.87) based on multi-source label convergence; Solana cluster F carries moderate confidence (0.64) due to limited public labeling infrastructure. This report is analytical, not accusatory — cluster identification does not imply specific trading strategy or directional positioning.`,
  },

  // Exploit postmortems (2)
  {
    id: "radiant-re-entry",
    title: "Radiant Capital Re-Entry Exploit: Multisig Compromise and Cross-Chain Lending Drain",
    author: "Dr. Yuki Tanaka · DeFi Risk Consortium",
    author_wallet: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    price_usdc: "0.003",
    tags: ["exploit", "radiant", "multisig", "lending", "research"],
    subheading:
      "October 2024 Radiant Capital $50M exploit postmortem: multisig device compromise, re-entry via upgraded market contracts, and cross-chain drain timeline.",
    body: `On October 16, 2024, Radiant Capital suffered a $50M exploit across Arbitrum and BNB Chain — the second attack on the protocol within 12 months. The root cause was a compromised multisig signer device: malware on a team member's hardware wallet exported transaction signing capabilities, allowing the attacker to pass malicious market upgrade proposals through Radiant's 3/11 Gnosis Safe. The attacker deployed modified lending market implementations that accepted undercollateralized borrows, then drained available liquidity across USDC, USDT, wBTC, and ETH markets.

The re-entry vector is the analytically significant element. Radiant had patched the first exploit (January 2024, $4.5M) by rotating multisig signers and upgrading market contracts. However, the October attacker exploited the legitimate upgrade pathway — submitting market parameter changes that appeared routine but introduced a borrow function bypass. The malicious upgrade passed because the compromised signer co-signed with two other signers who did not detect bytecode changes in the 48KB contract diff. Post-incident analysis shows 73% of the diff was obfuscated initialization code.

Cross-chain drain timeline: Arbitrum markets were drained in 11 minutes ($38M), followed by BNB Chain markets in 7 minutes ($12M). The attacker routed stolen funds through THORChain, Maya Protocol, and finally to Bitcoin via renounced-bridged assets — achieving effective chain-hopping that delayed forensic tracing by 72 hours. Radiant's pause mechanism activated 23 minutes after initial drain, too late for primary market recovery.

Lessons for agents and protocols: multisig transaction previews must include bytecode diff analysis, not just function selector summaries; market upgrade proposals require timelock delays exceeding maximum bridge finality times; cross-chain lending protocols need independent pause authority per chain. Monitor Radiant recovery proceedings, similar multisig governance patterns in lending protocols, and attacker fund movement from attributed addresses.`,
  },
  {
    id: "penpie-delegatecall",
    title: "Penpie Delegatecall Exploit: Arbitrary Code Execution via Reward Claiming Logic",
    author: "Anika Sharma · Move Security Collective",
    author_wallet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    price_usdc: "0.002",
    tags: ["exploit", "penpie", "delegatecall", "pendle", "research"],
    subheading:
      "September 2024 Penpie $27M exploit: delegatecall vulnerability in batch reward claiming, Pendle PT/YT market manipulation, and fund recovery status.",
    body: `On September 10, 2024, Penpie — a Pendle Finance yield aggregator — lost approximately $27M across Ethereum and Arbitrum through a delegatecall vulnerability in its batch reward claiming contract. The attacker deployed a malicious helper contract and invoked Penpie's batchClaimRewards function, which used delegatecall to execute claim logic in the context of Penpie's proxy storage. Because delegatecall preserves the caller's storage context, the attacker's code operated with Penpie's admin privileges, enabling arbitrary token transfers from the protocol's reward distributor.

Technical root cause: the batchClaimRewards function accepted an arbitrary _rewardContract address parameter and delegatecalled into it without whitelist validation. The attacker's contract implemented a claim() function that, when delegatecalled, executed transfer() on all tokens held by the Penpie proxy. Total drain encompassed 3,750 ETH, 8.2M USDC, and assorted Pendle PT/YT tokens from active markets. The Pendle PT token transfers were particularly damaging because they represented locked yield positions that Penpie held on behalf of depositors.

Market manipulation secondary effects: the attacker sold stolen Pendle PT tokens into thin secondary markets, depressing PT prices by 4–8% on affected maturities for 6 hours before arbitrageurs restored parity. Pendle's isolated market architecture contained contagion — unaffected PT markets maintained peg within 12 bps throughout the event.

Recovery status as of June 2026: Penpie has recovered $8.3M through onchain negotiation (attacker returned 31% of stolen funds in exchange for whitehat bounty designation), insurance coverage contributed $4.1M, and the protocol issued PENPIE compensation tokens for remaining shortfall. Pendle Finance was not liable but implemented mandatory reward contract whitelisting across all integrated aggregators.

Defensive pattern for agents: never interact with protocols that delegatecall into user-supplied addresses; verify reward claiming contracts against Pendle's published integration guidelines; monitor Pendle aggregator TVL for anomalous outflows exceeding 5% hourly.`,
  },

  // Governance (2)
  {
    id: "arbitrum-dao-treasury",
    title: "Arbitrum DAO Treasury: ARB Allocation, Delegate Power Concentration, and Spending Runway",
    author: "Sofia Andersson · OP Collective Research",
    author_wallet: "0x912CE59144191C1204E64559FE8253a9e0E2D7d0",
    price_usdc: "0.001",
    tags: ["governance", "arbitrum", "dao", "treasury", "research"],
    subheading:
      "Arbitrum DAO treasury composition, ARB token allocation schedule, top delegate voting power, and approved budget runway through 2027.",
    body: `The Arbitrum DAO controls one of the largest protocol treasuries in Ethereum L2 ecosystems: approximately 3.56B ARB tokens (42% of total supply) held across the DAO treasury, Arbitrum Foundation administrative wallets, and vested allocation contracts. At June 2026 prices ($0.82/ARB), total treasury value approximates $2.9B, though liquid deployable reserves — excluding vesting schedules and Foundation operational allocations — are closer to $1.1B.

Spending trajectory accelerated in H1 2026: approved proposals allocated $180M to ecosystem grants (STIP-2 continuation), $45M to Arbitrum BoLD fault-proof development, and $32M to Orbit chain onboarding incentives. Quarterly burn rate averages $42M, implying 26-month runway on liquid reserves at current pace without ARB price appreciation or revenue offset. The Arbitrum Timeboost sequencer fee auction, launched in April 2026, contributes approximately $2.1M monthly revenue to the DAO — meaningful but insufficient to cover grant obligations alone.

Delegate power concentration remains the governance risk vector. Top-5 delegates control 38% of votable ARB supply; the top delegate (Gauntlet-affiliated) alone holds 12.3%. Proposal passage threshold is 3% quorum with simple majority — achievable with coordinated top-delegate alignment. Controversial proposals (ARB staking activation, treasury diversification into stablecoins) have split top delegates, producing 55–60% approval margins that indicate governance is functional but not deeply decentralized.

Agents monitoring Arbitrum governance should track: STIP grant recipient performance metrics, Foundation vesting unlock calendar (next major unlock: 92M ARB in September 2026), delegate turnover rates, and Timeboost revenue growth as sequencer fee market matures. Treasury diversification proposals are the highest-impact governance events for ARB token supply dynamics.`,
  },
  {
    id: "uniswap-fee-switch",
    title: "Uniswap Fee Switch: UNI Holder Revenue Rights and v3 Activation Mechanics",
    author: "Rachel Kim · L2 Economics Desk",
    author_wallet: "0x1f9840a85d8aF53cb65Bf8a3376dbD95B0e16b9",
    price_usdc: "0.002",
    tags: ["governance", "uniswap", "fee-switch", "uni", "research"],
    subheading:
      "Uniswap v3 protocol fee switch governance history, treasury impact modeling at 1/6 default fee tier, and UNI holder distribution mechanics.",
    body: `The Uniswap fee switch — enabling protocol fees on v3 pools that flow to UNI token holders or the protocol treasury — has been the most debated governance topic in DeFi since v3's 2021 launch. As of June 2026, the fee switch remains inactive on mainnet despite multiple governance proposals (most recently DIP-20 in February 2026, which failed with 42% support against 38% opposition and 20% abstention). The debate centers on whether protocol fees deter liquidity providers and accelerate volume migration to fee-free competitors.

Impact modeling at the default 1/6 protocol fee tier (one-sixth of pool swap fees directed to protocol): applying this to H1 2026 v3 mainnet volume ($478B) with average pool fee of 5 bps yields approximately $398M annualized protocol revenue. Distribution mechanics remain undefined — proposals have suggested 100% to UNI burn, 50/50 burn/treasury, and direct UNI holder staking rewards. Each model produces different UNI token supply and yield implications.

LP behavior modeling is the critical uncertainty. Historical precedent from SushiSwap's fee switch (2020) showed 23% TVL migration within 30 days. Uniswap's deeper liquidity moat suggests lower migration (our model: 8–12% TVL impact at 1/6 tier), but concentrated liquidity positions on competitive pairs (ETH/USDC, ETH/USDT) are most elastic. L2 deployments complicate governance: Uniswap v3 on Arbitrum and Base generates 34% of total protocol volume but operates under separate governance jurisdiction via Uniswap DAO's chain-specific proposals.

Risk factors for agents: fee switch activation is a binary governance event that would reprice UNI on anticipation alone; LP migration would temporarily widen spreads on affected pairs; legal classification of UNI fee revenue as securities income remains unresolved in US jurisdiction. Monitor Uniswap governance forum for revised fee switch proposals, LP retention surveys, and competitive AMM fee policy changes on Curve and Balancer.`,
  },

  // Yield strategies (3)
  {
    id: "pendle-carry",
    title: "Pendle Carry Trades: PT Discount Harvesting and Yield Curve Positioning",
    author: "Thomas Bergmann · European Digital Finance Lab",
    author_wallet: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    price_usdc: "0.003",
    tags: ["yield", "pendle", "carry", "fixed-yield", "research"],
    subheading:
      "Pendle PT implied yield versus underlying APY, carry trade entry/exit timing, and ETH/stETH maturity curve positioning for Q3 2026.",
    body: `Pendle Finance splits yield-bearing assets into Principal Tokens (PT) and Yield Tokens (YT), enabling fixed-rate yield trading on variable-rate DeFi positions. The carry trade — buying PT at discount to face value and holding to maturity — is Pendle's core institutional strategy. As of June 2026, Pendle TVL exceeds $4.8B across 40+ asset maturities, with ETH, stETH, and USDe markets dominating volume.

PT discount mechanics: a stETH PT maturing December 2026 trades at 0.942 ETH (5.8% implied fixed yield) when stETH staking yield is 3.4% and market expects 0.5% rate cuts. The 2.9% spread represents the carry premium — compensation for locking capital and bearing smart-contract, liquidity, and rate risk. Historical analysis of 28 matured Pendle markets shows 96% of PT positions delivered implied yield within 15 bps of theoretical, with deviations concentrated in markets affected by underlying protocol incidents (e.g., Ethena USDe depeg events).

Optimal entry timing correlates with yield curve dislocations. Carry trades initiated when PT implied yield exceeds underlying APY by > 200 bps (current stETH Dec-2026: 240 bps spread) have median 30-day mark-to-market gain of 1.8% even before maturity convergence. Exit before maturity via PT sale is viable on deep markets (stETH, USDe) but costly on thin markets — ETH PT Sep-2026 exit slippage exceeds 40 bps for positions > $500k.

Risks: underlying protocol yield reduction (Lido staking rate cuts, Ethena funding negative turns), Pendle market liquidity evaporation near maturity (observed 60% depth reduction in final 7 days), and smart-contract risk on Pendle's yield splitter contracts. Agents should model carry as hold-to-maturity strategy on deep markets and monitor implied yield spreads weekly for entry signals exceeding 150 bps threshold.`,
  },
  {
    id: "ethena-susde-basis",
    title: "Ethena sUSDe Basis Trade: Funding Rate Dependency and Negative Carry Scenarios",
    author: "Elena Vasquez · Stablecoin Analytics",
    author_wallet: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    price_usdc: "0.002",
    tags: ["yield", "ethena", "susde", "basis", "research"],
    subheading:
      "Ethena sUSDe yield decomposition, perpetual funding rate sensitivity, negative carry frequency, and USDe supply dynamics.",
    body: `Ethena's USDe synthetic dollar generates yield through delta-neutral basis trades: holding spot ETH/stETH while shorting equivalent perpetual futures to capture funding rates. sUSDe (staked USDe) passes this yield to depositors, achieving 8–18% APY during positive funding environments. USDe supply reached $2.8B by June 2026, with sUSDe representing 74% of deposits — indicating yield-seeking dominance over transactional USDe usage.

Yield decomposition for June 2026: perpetual funding rates contributed 11.2% annualized (weighted across Binance, Bybit, Deribit venues), ETH staking yield added 2.8%, and Ethena protocol reserve yield contributed 0.4%. Total sUSDe APY: 14.4%. Funding rate sensitivity is extreme: our regression shows 1 basis point change in average 8-hour funding rate shifts sUSDe APY by 0.82 percentage points annualized. During the April 2026 funding rate collapse (average funding turned negative for 11 days), sUSDe APY briefly fell to 2.1%, triggering $340M in sUSDe redemptions.

Negative carry scenarios deserve explicit modeling. When funding rates are negative, Ethena's reserve fund (funded by prior positive-carry surplus) subsidizes yields to maintain sUSDe APY above 4% floor. Reserve fund balance is approximately $89M — sufficient to subsidize 6.2 months of -5% annualized funding at current USDe supply. Reserve exhaustion would pass negative carry directly to sUSDe holders, a tail risk that institutional allocators must price.

Monitor Binance/Bybit ETH perpetual funding rates (8-hour snapshots), USDe premium/discount on Curve, Ethena reserve fund balance disclosures, and sUSDe redemption queue depth during funding rate inversions. Agents holding sUSDe should set funding rate alert thresholds at -0.01% per 8-hour period as early warning for yield compression.`,
  },
  {
    id: "lrt-liquidity-premium",
    title: "LRT Liquidity Premium: ezETH, rsETH, and Restaking Token Secondary Market Dynamics",
    author: "James Okoro · Payments Infrastructure Group",
    author_wallet: "0xae78736Cd615f374D308CbBb0fd95a9a3f0b85bf",
    price_usdc: "0.001",
    tags: ["yield", "lrt", "restaking", "liquidity", "research"],
    subheading:
      "Liquid restaking token premium/discount versus NAV, EigenLayer withdrawal queue impact, and cross-LRT arbitrage opportunities.",
    body: `Liquid Restaking Tokens (LRTs) — ezETH (Renzo), rsETH (Kelp), weETH (Ether.fi), and pufETH (Puffer) — represent EigenLayer restaked positions tradable on secondary markets. LRTs typically trade at premium to NAV during restaking yield enthusiasm and at discount during withdrawal queue congestion or slashing concerns. As of June 2026, total LRT market cap exceeds $5.2B, with ezETH ($1.8B) and weETH ($1.6B) leading.

Liquidity premium quantification: ezETH trades at +0.08% premium to NAV (ETH-denominated), rsETH at -0.14% discount, weETH at +0.03% premium, pufETH at -0.31% discount. Discount hierarchy correlates with withdrawal queue depth — pufETH's 31 bps discount reflects 14-day estimated withdrawal time versus ezETH's 2-day queue. Arbitrageurs minting LRTs at NAV and selling at premium capture spread minus gas; current ezETH arb window yields 4 bps net after gas on $100k trades, viable only for automated systems.

EigenLayer withdrawal queue is the systemic risk factor. Total queued withdrawals reached 142,000 ETH in June 2026 (peak), with processing rate of 8,400 ETH daily under current protocol parameters. Queue depth directly depresses LRT secondary prices: regression coefficient shows each 10,000 ETH of queue depth widens average LRT discount by 6 bps. Cap on LRT minting (per-protocol TVL limits) creates supply inelasticity that amplifies premium during demand surges.

Risks: EigenLayer slashing events would reprice all LRTs simultaneously; withdrawal queue processing rate changes via governance could shift premium/discount overnight; LRT smart-contract risk is additive to EigenLayer + underlying LST (stETH) risk stack. Agents should monitor EigenLayer withdrawal queue depth, LRT premium/discount on Balancer/Curve pools, and per-protocol AVS slashing events as leading indicators for LRT secondary market repricing.`,
  },

  // Protocol research (2)
  {
    id: "eigenlayer-operator-churn",
    title: "EigenLayer Operator Churn: AVS Assignment Patterns and Restaker Yield Impact",
    author: "Dr. Kenji Watanabe · Rollup Engineering Lab",
    author_wallet: "0xBe9895146f7AF8F02bbb1F3d6C55F11eA3bF18b8",
    price_usdc: "0.002",
    tags: ["protocol", "eigenlayer", "restaking", "operators", "research"],
    subheading:
      "EigenLayer operator entry/exit rates, AVS diversification strategies, operator concentration risk, and restaker yield variance by operator selection.",
    body: `EigenLayer's restaking protocol allows ETH stakers to opt into additional validation services (Actively Validated Services, AVSs) in exchange for supplemental yield. Operator selection — the entity running validation infrastructure on behalf of restakers — is the primary determinant of both yield and risk exposure. As of June 2026, 287 registered operators serve 14 live AVSs, managing 4.2M ETH in restaked assets across 12,400 unique restaker delegations.

Operator churn metrics for H1 2026: 34 new operators registered, 8 operators deregistered (voluntary exit), and 19 operators changed AVS participation sets. Monthly churn rate of 2.8% is elevated versus traditional PoS validator churn (0.3–0.5%), reflecting AVS landscape volatility as new services launch and sunset. Operators running 3+ AVSs simultaneously show 41% lower churn than single-AVS operators, suggesting diversification as retention strategy.

Concentration risk is material: top-10 operators by restaked ETH control 52% of total restaked assets. The largest operator (Figment-affiliated) manages 312,000 ETH across 7 AVSs. Slashing correlation risk emerges when multiple AVSs share operator infrastructure — a slashing event on one AVS could trigger operator reputation damage and restaker redelegation cascades across co-located AVSs.

Restaker yield variance by operator selection spans 2.1% (conservative, established operators with 99.9% uptime) to 8.4% (aggressive, multi-AVS operators accepting higher slashing risk). Yield differential is not purely risk compensation — operator fee structures vary from 0% (subsidized by operator treasury) to 12% of AVS rewards. Agents delegating restaked ETH should evaluate: operator AVS diversification, historical uptime, fee structure, and slashing history. Monitor EigenLayer operator registration/deregistration events, AVS reward rate changes, and EigenDA blob throughput requirements as leading indicators for operator economics.`,
  },
  {
    id: "celestia-blobspace-demand",
    title: "Celestia Blobspace Demand: Rollup Data Availability Economics and TIA Staking Yield",
    author: "Liam O'Connell · Onchain Markets Unit",
    author_wallet: "0x467719Ad09025Fc6cEc6c66bE7E7d7dc9C5ae9A4",
    price_usdc: "0.003",
    tags: ["protocol", "celestia", "blobspace", "da", "research"],
    subheading:
      "Celestia blob submission volumes, fee market dynamics, rollup DA cost comparison versus Ethereum blobs, and TIA staking reward outlook.",
    body: `Celestia provides modular data availability (DA) for rollups, separating consensus and data publishing from execution. Rollups submit "blobs" — batches of transaction data — to Celestia's validators for ordering and availability guarantees. Blob submission volume reached 2.8M blobs in June 2026 (up from 890K in January), driven by new rollup launches on Celestia's Mocha and Mainnet beta networks, plus Ethereum L2s experimenting with Celestia as external DA layer.

Fee market dynamics follow EIP-1559-style pricing: base fee adjusts based on blobspace utilization relative to target capacity (currently 1.33 MB/s). Average blob fee in June 2026: 0.08 TIA per blob (approximately $0.12 at $1.48/TIA), with p99 spikes to 0.45 TIA during Mocha testnet airdrop farming events. For a rollup submitting 1,000 blobs daily, Celestia DA cost approximates $120/day — versus $840/day for equivalent Ethereum EIP-4844 blob space at June 2026 blob base fees. Cost advantage is the primary adoption driver.

Rollup DA cost comparison (per MB of data, June 2026): Celestia $0.09, Ethereum blobs $0.62, Avail $0.14, EigenDA $0.04 (subsidized). EigenDA's subsidized pricing undercuts Celestia but carries EigenLayer dependency; Celestia offers sovereign DA without Ethereum coupling. Three production rollups (Manta Pacific, Eclipse, Croll) have committed to Celestia DA for mainnet; five additional rollups are in integration testing.

TIA staking yield derives from blob fees (30% to stakers, 20% to validators, 50% burned) plus inflation (currently 8% annualized, decreasing per halving schedule). Effective staking APY: 12.4% for active validators, 9.8% for delegated stakers. Blob fee burn creates deflationary pressure during high-demand periods — June 2026 burn rate offset 18% of inflation issuance.

Risks: blobspace demand is concentrated in testnet/experimental rollups with unproven retention; TIA price volatility affects rollup DA cost predictability; Ethereum blob fee reductions via proto-danksharding upgrades could narrow cost advantage. Monitor Celestia blob submission rate, active rollup count, TIA burn rate, and competitor DA layer (Avail, EigenDA) pricing changes.`,
  },
];

function formatMarkdown(post: SeedPost): string {
  const tagsJson = JSON.stringify(post.tags);
  return `---
id: ${post.id}
title: ${post.title}
author: ${post.author}
author_wallet: "${post.author_wallet}"
price_usdc: "${post.price_usdc}"
tags: ${tagsJson}
subheading: ${post.subheading}
---

${post.body}
`;
}

async function generateSeeds(): Promise<string[]> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const written: string[] = [];

  for (const post of POSTS) {
    if (SKIP_IDS.has(post.id)) {
      continue;
    }

    const filePath = path.join(OUTPUT_DIR, `${post.id}.md`);

    try {
      await fs.access(filePath);
      continue;
    } catch {
      // file does not exist — proceed
    }

    await fs.writeFile(filePath, formatMarkdown(post), "utf8");
    written.push(`${post.id}.md`);
  }

  return written;
}

async function main(): Promise<void> {
  const written = await generateSeeds();
  console.log(`Wrote ${written.length} research seed file(s):`);
  for (const name of written) {
    console.log(`  ${name}`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}