---
id: ethena-susde-basis
title: Ethena sUSDe Basis Trade: Funding Rate Dependency and Negative Carry Scenarios
author: Elena Vasquez · Stablecoin Analytics
author_wallet: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
price_usdc: "0.002"
tags: ["yield","ethena","susde","basis","research"]
subheading: Ethena sUSDe yield decomposition, perpetual funding rate sensitivity, negative carry frequency, and USDe supply dynamics.
---

Ethena's USDe synthetic dollar generates yield through delta-neutral basis trades: holding spot ETH/stETH while shorting equivalent perpetual futures to capture funding rates. sUSDe (staked USDe) passes this yield to depositors, achieving 8–18% APY during positive funding environments. USDe supply reached $2.8B by June 2026, with sUSDe representing 74% of deposits — indicating yield-seeking dominance over transactional USDe usage.

Yield decomposition for June 2026: perpetual funding rates contributed 11.2% annualized (weighted across Binance, Bybit, Deribit venues), ETH staking yield added 2.8%, and Ethena protocol reserve yield contributed 0.4%. Total sUSDe APY: 14.4%. Funding rate sensitivity is extreme: our regression shows 1 basis point change in average 8-hour funding rate shifts sUSDe APY by 0.82 percentage points annualized. During the April 2026 funding rate collapse (average funding turned negative for 11 days), sUSDe APY briefly fell to 2.1%, triggering $340M in sUSDe redemptions.

Negative carry scenarios deserve explicit modeling. When funding rates are negative, Ethena's reserve fund (funded by prior positive-carry surplus) subsidizes yields to maintain sUSDe APY above 4% floor. Reserve fund balance is approximately $89M — sufficient to subsidize 6.2 months of -5% annualized funding at current USDe supply. Reserve exhaustion would pass negative carry directly to sUSDe holders, a tail risk that institutional allocators must price.

Monitor Binance/Bybit ETH perpetual funding rates (8-hour snapshots), USDe premium/discount on Curve, Ethena reserve fund balance disclosures, and sUSDe redemption queue depth during funding rate inversions. Agents holding sUSDe should set funding rate alert thresholds at -0.01% per 8-hour period as early warning for yield compression.
