---
id: nanopayments-economics
title: The Economics of Sub-Cent Payments
author: Marcus Chen
author_wallet: "0x8Ba1f109551bD4328030126455ac136c22C177e9"
price_usdc: "0.001"
tags: ["payments", "usdc", "micropayments"]
---

Batch settlement collapses thousands of signed authorizations into a single onchain transaction. Without batching, gas dominates any payment below roughly five cents on most EVM chains.

Circle Gateway on Arc Testnet demonstrates gasless buyer flows: agents sign offchain, sellers batch-settle, creators earn without per-call gas overhead.