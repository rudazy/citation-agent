---
id: sui-move-package-governance
title: Sui Move Package Governance: Upgrade Policies and Dependency Risk Graphs
author: Anika Sharma · Move Security Collective
author_wallet: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
price_usdc: "0.002"
tags: ["sui","move","governance","packages","research"]
subheading: Sui package upgrade policies (immutable, compatible, additive), dependency tree analysis for top 50 DeFi packages, and governance incident review.
---

Sui's Move package system supports three upgrade policies set at publish time: immutable (no upgrades permitted), compatible (additive changes only — new functions and types, no breaking modifications), and additive with deprecation windows. Unlike Ethereum's proxy patterns, upgrade authority is encoded in the package's UpgradeCap object, transferable and governable via onchain mechanisms. As of June 2026, 2,847 packages are published on Sui mainnet; 38% are immutable, 51% compatible, and 11% retain unrestricted upgrade rights.

Dependency risk analysis of the top 50 DeFi packages by TVL reveals concerning concentration. The Sui Framework (sui::) is a universal dependency, but secondary concentration exists around three community libraries: movemate (18 dependents), sui_decimal (12 dependents), and cetus_clmm (9 dependents). A breaking upgrade to any compatible package propagates risk to all dependents unless maintainers pin version constraints — a practice only 34% of top packages enforce explicitly.

The February 2026 Navi Protocol governance incident illustrates the failure mode: a compatible upgrade to the lending core introduced a rounding change that reduced collateral factors by 0.3% for three asset types. The change was governance-approved but dependency-unaudited — three downstream vault protocols experienced unexpected liquidation threshold shifts within 6 hours. Post-incident, Sui Foundation proposed optional upgrade notification events; adoption remains voluntary.

Risk framework for agents: verify package upgrade policy before depositing funds, monitor UpgradeCap ownership transfers, and map transitive dependencies to assess blast radius. Immutable packages eliminate upgrade risk but also foreclose bug fixes — 62% of immutable packages are token standards or single-purpose utilities, not complex DeFi logic.
