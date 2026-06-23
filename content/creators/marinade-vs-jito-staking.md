---
id: marinade-vs-jito-staking
title: Marinade vs Jito Staking: LST Premium, MEV Revenue Split, and Validator Decentralization
author: Elena Okonkwo · Agent Markets Lab
author_wallet: "0x1111111111111111111111111111111111111111"
price_usdc: "0.003"
tags: ["solana","staking","marinade","jito","research"]
subheading: mSOL vs JitoSOL yield decomposition, MEV tip distribution, and validator concentration metrics for Solana liquid staking tokens.
---

Liquid staking on Solana is dominated by two protocols: Marinade (mSOL, $1.2B TVL) and Jito (JitoSOL, $2.1B TVL). Both issue liquid staking tokens (LSTs) representing delegated SOL, but differ fundamentally in MEV strategy and revenue distribution. Marinade offers native staking and liquid staking with optional MEV-enabled validator selection; Jito mandates MEV tip capture via its block engine, distributing tips pro-rata to JitoSOL holders.

Yield decomposition for June 2026 (annualized): base staking rewards average 7.2% for both LSTs. JitoSOL captures an additional 1.8–2.4% from MEV tips, while mSOL MEV-enabled tranches add 0.9–1.3%. The JitoSOL premium reflects structural MEV participation — Jito validators running the block engine capture tips that Marinade's default validator set partially foregoes. However, JitoSOL trades at a 0.12% discount to NAV on secondary markets versus mSOL's 0.04% discount, partially offsetting yield advantage.

Validator decentralization metrics reveal trade-offs. Marinade delegates across 120+ validators with maximum 3% stake concentration per validator. Jito's validator set is smaller (38 active) with top-5 validators holding 28% of JitoSOL stake — concentration that creates slashing correlation risk. Nakamoto coefficient for JitoSOL is 12 versus mSOL's 23.

Risks: Solana slashing events (rare but catastrophic for LST NAV); Jito MEV tip volatility — tips fell 62% during April 2026 memecoin lull; regulatory classification of MEV revenue as securities income in some jurisdictions. Monitor LST premium/discount on Jupiter, validator uptime and skip rates, and Solana foundation staking yield adjustments post SIMD proposals.
