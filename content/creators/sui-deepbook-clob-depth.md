---
id: sui-deepbook-clob-depth
title: Sui DeepBook CLOB Depth: Maker-Taker Flows and Cross-Protocol Liquidity
author: Liam O'Connell · Onchain Markets Unit
author_wallet: "0xE592427A0AEce92De3Edee1F18E0157C05861564"
price_usdc: "0.001"
tags: ["sui","deepbook","clob","liquidity","research"]
subheading: DeepBook V2 order book depth metrics, maker rebate economics, and SUI/USDC spread comparison versus CEX benchmarks.
---

DeepBook is Sui's native central limit order book (CLOB), providing protocol-level spot trading infrastructure that DeFi protocols can integrate via composable order placement. DeepBook V2, launched in January 2026, introduced maker rebates (0.02% rebate vs 0.04% taker fee), flash loan integration for atomic arbitrage, and permissionless market creation for whitelisted asset pairs. Daily volume averaged $42M in June 2026, with SUI/USDC representing 68% of flow.

Order book depth analysis at ±10 bps from mid-price shows $1.8M cumulative depth for SUI/USDC — sufficient for trades up to $180k with < 10 bps slippage, but materially thinner than Binance SUI/USDT ($14M at equivalent bands). Maker-taker ratio has stabilized at 1.4:1 after rebate introduction, up from 0.7:1 in V1, indicating improved market-making participation. Three market-making firms account for 61% of resting liquidity, creating concentration risk similar to CEX order book dynamics.

Cross-protocol integration is DeepBook's strategic differentiator. Cetus CLMM routes large orders through DeepBook for price discovery before on-chain settlement, reducing CLMM impermanent loss exposure. Turbos and Aftermath protocols consume DeepBook mid-prices as oracle inputs. This composability creates feedback loops: DeepBook depth attracts CLMM volume, which attracts more market makers to DeepBook.

Risks: market maker concentration enables manipulation of oracle feeds derived from mid-price; permissionless market creation could introduce low-liquidity pairs used for price spoofing; SUI price volatility directly impacts book depth as market makers widen spreads. Monitor DeepBook V2 volume-weighted spread, top maker address inventory changes, and new market creation events for emerging asset pairs.
