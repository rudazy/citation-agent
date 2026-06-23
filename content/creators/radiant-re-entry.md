---
id: radiant-re-entry
title: Radiant Capital Re-Entry Exploit: Multisig Compromise and Cross-Chain Lending Drain
author: Dr. Yuki Tanaka · DeFi Risk Consortium
author_wallet: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
price_usdc: "0.003"
tags: ["exploit","radiant","multisig","lending","research"]
subheading: October 2024 Radiant Capital $50M exploit postmortem: multisig device compromise, re-entry via upgraded market contracts, and cross-chain drain timeline.
---

On October 16, 2024, Radiant Capital suffered a $50M exploit across Arbitrum and BNB Chain — the second attack on the protocol within 12 months. The root cause was a compromised multisig signer device: malware on a team member's hardware wallet exported transaction signing capabilities, allowing the attacker to pass malicious market upgrade proposals through Radiant's 3/11 Gnosis Safe. The attacker deployed modified lending market implementations that accepted undercollateralized borrows, then drained available liquidity across USDC, USDT, wBTC, and ETH markets.

The re-entry vector is the analytically significant element. Radiant had patched the first exploit (January 2024, $4.5M) by rotating multisig signers and upgrading market contracts. However, the October attacker exploited the legitimate upgrade pathway — submitting market parameter changes that appeared routine but introduced a borrow function bypass. The malicious upgrade passed because the compromised signer co-signed with two other signers who did not detect bytecode changes in the 48KB contract diff. Post-incident analysis shows 73% of the diff was obfuscated initialization code.

Cross-chain drain timeline: Arbitrum markets were drained in 11 minutes ($38M), followed by BNB Chain markets in 7 minutes ($12M). The attacker routed stolen funds through THORChain, Maya Protocol, and finally to Bitcoin via renounced-bridged assets — achieving effective chain-hopping that delayed forensic tracing by 72 hours. Radiant's pause mechanism activated 23 minutes after initial drain, too late for primary market recovery.

Lessons for agents and protocols: multisig transaction previews must include bytecode diff analysis, not just function selector summaries; market upgrade proposals require timelock delays exceeding maximum bridge finality times; cross-chain lending protocols need independent pause authority per chain. Monitor Radiant recovery proceedings, similar multisig governance patterns in lending protocols, and attacker fund movement from attributed addresses.
