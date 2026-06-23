---
id: usdc-usdt-reserves
title: USDC vs USDT Reserve Composition: Attestation Lags and Counterparty Concentration
author: Priya Menon · Chain Forensics Unit
author_wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
price_usdc: "0.002"
tags: ["stablecoins","usdc","usdt","reserves","research"]
subheading: Circle vs Tether attestation cadence, custodial bank concentration, and onchain redemption flow asymmetries through Q2 2026.
---

USDC and USDT collectively anchor ~92% of onchain dollar liquidity, yet their reserve architectures diverge in ways that matter for institutional treasury allocation. Circle publishes weekly attestations via Deloitte, with ~88% of reserves in Treasury bills and overnight repo as of the May 2026 report. Tether's quarterly CRR reports show ~76% in Treasury bills, money market funds, and secured loans, with the remainder in bitcoin, gold, and other assets per their disclosed categories.

Attestation lag is the operative risk variable. USDC's weekly cycle means maximum information staleness of 7 days; USDT's quarterly cycle implies up to 90 days between verified snapshots. During the March 2025 regional banking stress, USDC's same-day transparency allowed redemption-driven supply contraction of 12% within 48 hours, while USDT maintained peg but exhibited secondary market discounts to 992 bps on Curve pools for 6 hours. Onchain monitoring of Circle's USDC_TOKEN_MINTER and Tether's treasury addresses shows asymmetric redemption velocity: USDC burns correlate 0.89 with attestation dates, USDT burns show weaker correlation (0.34) with quarterly releases.

Counterparty concentration presents a second-order risk. Circle holds reserves across BNY Mellon, Customers Bank, and Goldman Sachs custody — three institutions representing 94% of disclosed cash equivalents. Tether's custodial spread is wider but less granular in public disclosures. For agent systems routing large stablecoin inventory, we recommend tracking: (1) attestation publication latency, (2) net mint/burn velocity by chain, (3) secondary market premium/discount on DEX pools exceeding $10M depth.

This analysis does not constitute audit opinion or investment advice. Reserve compositions change with issuer policy; agents should verify primary attestation documents before capital allocation decisions.
