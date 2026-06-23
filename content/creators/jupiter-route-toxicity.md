---
id: jupiter-route-toxicity
title: Jupiter Route Toxicity: Slippage Surfaces and Sandwich Exposure on Solana DEX Aggregator
author: Diego Morales · Solana MEV Lab
author_wallet: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
price_usdc: "0.002"
tags: ["solana","jupiter","mev","dex","research"]
subheading: Route-level toxicity scoring across Jupiter V6, sandwich attack rates by pool type, and Jito bundle co-location effects on execution quality.
---

Jupiter aggregates liquidity across 20+ Solana DEXs, routing ~$1.8B daily swap volume as of June 2026. Route toxicity — the degree to which a swap path is exploitable by sandwich attackers — varies dramatically by pool composition, hop count, and execution timing relative to Jito block engine slots. We analyzed 840,000 Jupiter swaps exceeding $1,000 notional over 14 days, scoring each route for realized slippage versus simulated fair-price execution.

Single-hop routes through Orca Whirlpools and Raydium CLMMs exhibit lowest toxicity (sandwich rate 2.1%, median excess slippage 3 bps). Multi-hop routes crossing Phoenix CLOB and Meteora DLMM pools show 8.7% sandwich rate and 14 bps median excess slippage. Routes involving low-liquidity meme token pairs exceed 22% sandwich rate, with excess slippage reaching 89 bps at p99. Jupiter's built-in slippage tolerance default (0.5%) is exploited systematically on volatile pairs — users accepting > 0.3% tolerance face 4.2x higher sandwich probability.

Jito bundle co-location materially alters execution quality. Swaps submitted via Jito bundles with tip ≥ 0.001 SOL experience 67% lower sandwich rate, as bundle ordering protects against intra-block frontrunning. However, bundle tips transfer surplus to validators rather than users, creating a pay-for-protection dynamic that disadvantages retail flow.

Mitigation recommendations for agents: set slippage tolerance to minimum viable for pair liquidity, prefer direct routes over multi-hop when price impact is comparable, use Jito bundles for trades > $10k notional on volatile pairs, and monitor Jupiter's route simulation API for pre-execution toxicity scores. Track Solana DEX pool creation velocity and Jito tip auction clearing prices as leading indicators of MEV environment intensity.
