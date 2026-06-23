---
id: penpie-delegatecall
title: Penpie Delegatecall Exploit: Arbitrary Code Execution via Reward Claiming Logic
author: Anika Sharma · Move Security Collective
author_wallet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
price_usdc: "0.002"
tags: ["exploit","penpie","delegatecall","pendle","research"]
subheading: September 2024 Penpie $27M exploit: delegatecall vulnerability in batch reward claiming, Pendle PT/YT market manipulation, and fund recovery status.
---

On September 10, 2024, Penpie — a Pendle Finance yield aggregator — lost approximately $27M across Ethereum and Arbitrum through a delegatecall vulnerability in its batch reward claiming contract. The attacker deployed a malicious helper contract and invoked Penpie's batchClaimRewards function, which used delegatecall to execute claim logic in the context of Penpie's proxy storage. Because delegatecall preserves the caller's storage context, the attacker's code operated with Penpie's admin privileges, enabling arbitrary token transfers from the protocol's reward distributor.

Technical root cause: the batchClaimRewards function accepted an arbitrary _rewardContract address parameter and delegatecalled into it without whitelist validation. The attacker's contract implemented a claim() function that, when delegatecalled, executed transfer() on all tokens held by the Penpie proxy. Total drain encompassed 3,750 ETH, 8.2M USDC, and assorted Pendle PT/YT tokens from active markets. The Pendle PT token transfers were particularly damaging because they represented locked yield positions that Penpie held on behalf of depositors.

Market manipulation secondary effects: the attacker sold stolen Pendle PT tokens into thin secondary markets, depressing PT prices by 4–8% on affected maturities for 6 hours before arbitrageurs restored parity. Pendle's isolated market architecture contained contagion — unaffected PT markets maintained peg within 12 bps throughout the event.

Recovery status as of June 2026: Penpie has recovered $8.3M through onchain negotiation (attacker returned 31% of stolen funds in exchange for whitehat bounty designation), insurance coverage contributed $4.1M, and the protocol issued PENPIE compensation tokens for remaining shortfall. Pendle Finance was not liable but implemented mandatory reward contract whitelisting across all integrated aggregators.

Defensive pattern for agents: never interact with protocols that delegatecall into user-supplied addresses; verify reward claiming contracts against Pendle's published integration guidelines; monitor Pendle aggregator TVL for anomalous outflows exceeding 5% hourly.
