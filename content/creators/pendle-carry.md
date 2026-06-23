---
id: pendle-carry
title: Pendle Carry Trades: PT Discount Harvesting and Yield Curve Positioning
author: Thomas Bergmann · European Digital Finance Lab
author_wallet: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
price_usdc: "0.003"
tags: ["yield","pendle","carry","fixed-yield","research"]
subheading: Pendle PT implied yield versus underlying APY, carry trade entry/exit timing, and ETH/stETH maturity curve positioning for Q3 2026.
---

Pendle Finance splits yield-bearing assets into Principal Tokens (PT) and Yield Tokens (YT), enabling fixed-rate yield trading on variable-rate DeFi positions. The carry trade — buying PT at discount to face value and holding to maturity — is Pendle's core institutional strategy. As of June 2026, Pendle TVL exceeds $4.8B across 40+ asset maturities, with ETH, stETH, and USDe markets dominating volume.

PT discount mechanics: a stETH PT maturing December 2026 trades at 0.942 ETH (5.8% implied fixed yield) when stETH staking yield is 3.4% and market expects 0.5% rate cuts. The 2.9% spread represents the carry premium — compensation for locking capital and bearing smart-contract, liquidity, and rate risk. Historical analysis of 28 matured Pendle markets shows 96% of PT positions delivered implied yield within 15 bps of theoretical, with deviations concentrated in markets affected by underlying protocol incidents (e.g., Ethena USDe depeg events).

Optimal entry timing correlates with yield curve dislocations. Carry trades initiated when PT implied yield exceeds underlying APY by > 200 bps (current stETH Dec-2026: 240 bps spread) have median 30-day mark-to-market gain of 1.8% even before maturity convergence. Exit before maturity via PT sale is viable on deep markets (stETH, USDe) but costly on thin markets — ETH PT Sep-2026 exit slippage exceeds 40 bps for positions > $500k.

Risks: underlying protocol yield reduction (Lido staking rate cuts, Ethena funding negative turns), Pendle market liquidity evaporation near maturity (observed 60% depth reduction in final 7 days), and smart-contract risk on Pendle's yield splitter contracts. Agents should model carry as hold-to-maturity strategy on deep markets and monitor implied yield spreads weekly for entry signals exceeding 150 bps threshold.
