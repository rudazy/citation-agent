---
id: curve-crvusd
title: Curve crvUSD Peg Dynamics: LLAMMA Bands, PegKeepers, and Liquidity Fragmentation
author: Elena Vasquez · Stablecoin Analytics
author_wallet: "0x9c4F24Ff0A13F2a6B3c7d8e9f0a1b2c3d4e5f6a7"
price_usdc: "0.001"
tags: ["defi","curve","crvusd","stablecoins","research"]
subheading: LLAMMA rebalancing bands, PegKeeper inventory flows, and crvUSD market share versus GHO and FRAX on Ethereum mainnet.
---

crvUSD maintains its dollar peg through the LLAMMA (Lending-Liquidating AMM Algorithm) — a soft liquidation mechanism that continuously rebalances collateral into crvUSD as prices decline, rather than triggering discrete liquidation events. As of June 2026, crvUSD circulating supply stands at $168M, with 72% backed by wstETH and sfrxETH collateral types. The PegKeeper contracts absorb peg deviations by minting or burning crvUSD against Curve stableswap pools.

Band width configuration is the primary peg stability lever. Narrow bands (1–2%) provide tighter peg adherence (median deviation 3 bps over 30 days) but increase rebalancing frequency and gas costs for borrowers. Wide bands (4–6%) reduce borrower UX friction but exhibit tail deviations up to 28 bps during ETH volatility spikes exceeding 8% daily moves. Our monitoring shows optimal band selection correlates with collateral asset volatility quartile, not absolute TVL.

Competitive positioning versus GHO ($312M supply) and legacy FRAX ($648M) reveals crvUSD's niche: deep integration with Curve gauge emissions drives 41% of borrow demand from yield farmers looping staked ETH positions. However, liquidity fragmentation across crvUSD/USDC pools on Ethereum, Arbitrum, and Optimism creates 5–15 bps cross-venue arb opportunities that PegKeepers partially close.

Key risks: PegKeeper inventory limits can exhaust during sustained one-sided pressure; wstETH basis blowouts propagate directly into crvUSD collateral ratios; gauge emission reductions would compress borrow demand. Track crvUSD premium/discount on secondary markets, PegKeeper utilization rates, and LLAMMA band migration proposals in Curve governance.
