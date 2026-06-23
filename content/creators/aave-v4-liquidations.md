---
id: aave-v4-liquidations
title: Aave v4 Liquidation Mechanics: Hub-Spoke Architecture and Bad Debt Containment
author: Dr. Yuki Tanaka · DeFi Risk Consortium
author_wallet: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12"
price_usdc: "0.003"
tags: ["defi","aave","liquidations","lending","research"]
subheading: Hub-spoke isolation, liquidation bonus curves, and simulated bad-debt paths under 40% ETH drawdown scenarios for Q3 2026 stress planning.
---

Aave v4 introduces a hub-and-spoke liquidity model where a central Liquidity Hub aggregates collateral across spoke markets, enabling cross-collateral efficiency while preserving risk isolation via spoke-level debt ceilings. Liquidation logic remains health-factor driven, but v4 adds configurable liquidation close factors per asset class and a gradual liquidation mode for large positions (> $500k notional) to reduce market impact.

Historical liquidation data from Aave v3 mainnet (Jan 2024–Jun 2026) shows 94.2% of liquidations execute within 5% of the liquidation threshold, with median bonus captured by liquidators at 4.8%. Simulating v4's gradual mode on the same corpus reduces average slippage cost to borrowers by 31% on positions exceeding $1M, at the expense of longer underwater windows — a trade-off that matters for correlated-asset drawdowns.

Our stress framework models a 40% ETH price shock with 25% stablecoin depeg secondary event. Under v3 parameters, projected bad debt accumulation peaks at $142M across ETH-correlated collateral pools. v4 spoke isolation contains this to $67M when stablecoin spokes are capped at 15% hub share, assuming liquidator participation rates hold at historical medians. The critical sensitivity is liquidator capital availability during gas spikes; Base and Arbitrum spokes show 2.3x faster liquidation completion than mainnet in identical scenarios.

Risk disclosures: hub concentration creates a single point of governance failure; oracle latency during bridge events has caused false liquidations in testnet drills; gradual liquidation may delay price discovery for distressed collateral. Monitor Aave governance proposals on spoke debt ceilings, liquidation bonus adjustments, and emergency pause modules.
