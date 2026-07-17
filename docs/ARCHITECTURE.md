# Citation Agent — Architecture

Focused reference for builders and coding agents. Live product behavior and full API tables live in [platform-overview.md](./platform-overview.md). This document covers **system shape** and the **end-to-end paid unlock** path from wallet connect to creator payout.

**Live:** [https://agentcitation.xyz](https://agentcitation.xyz)  
**Chain:** Arc Testnet (`eip155:5042002`)  
**License:** Apache-2.0

---

## Layers

| Layer | Responsibility | Primary code |
| --- | --- | --- |
| Next.js App Router | Marketplace UI, profiles, report landings, dashboard | `app/`, `components/` |
| API routes | Catalog, x402 unlock, Gateway, agent wallet, attestation, TrustGate | `app/api/` |
| Payment primitive | HTTP 402 challenge, verify/settle via Circle batch facilitator | `lib/x402.ts` |
| Gateway ops | Deposit, server-side pay, balance, withdraw | `app/api/gateway/*`, `lib/gateway-*.ts` |
| Session agent wallet | Encrypted per-browser wallet bound to `agent_session` cookie | `lib/agent-wallet.ts`, `lib/agent-session.ts`, `proxy.ts` |
| Royalty ledger | Post-unlock creator earnings + agent reputation counters | `lib/royalties.ts`, Supabase |
| Attestation | On-chain USDC stake behind a target; Arcscan-first claims index | `contracts/Attestation.sol`, `lib/attestation*.ts`, `lib/arcscan-attestations.ts`, `lib/arc-rpc.ts` |
| Profile account | `/profile` setup · payout / tip wallets · unlock earnings | `app/profile/`, `lib/platform-profile.ts`, `lib/publish-payout.ts`, `lib/creator-tip.ts` |
| TrustGate (optional) | Free arc-score badges + paid verify cache | `lib/trustgate*.ts` |
| Persistence | Posts, drafts, profiles, follows, comments, wallets, earnings | Supabase + `content/creators/*.md` seeds |

```text
Client (browser / CLI)
  → Next.js UI + API
    → Circle BatchFacilitator (x402 verify/settle)
      → Circle Gateway API → Arc Gateway wallet (USDC)
    → Attestation.sol (optional stake)
    → Supabase (ledger, posts, encrypted agent keys)
```

---

## Payment model (summary)

1. Buyers hold **USDC on Arc**, then **deposit into Circle Gateway** so each unlock does not require a new wallet popup for every resource.
2. Protected routes use **`withGateway`** (`lib/x402.ts`): missing payment → **HTTP 402** + base64 `PAYMENT-REQUIRED` header; present signature → facilitator **verify** then **settle**.
3. Settlement debits the buyer's **Gateway balance** and pays the route's **`payTo`** address (per-post `payout_wallet`, or platform `SELLER_ADDRESS` for legacy seeds).
4. Unlock amount goes **in full to the creator** when `payout_wallet` is set. Platform revenue on this product is primarily **attestation fees**, not an unlock split.
5. Server records `payment_events` and `creator_earnings` when Supabase is configured.

---

## End-to-end: paid unlock (human, session agent wallet)

This is the main marketplace path. MetaMask/WalletConnect can fund and deposit; the session **agent wallet** is what pays unlocks without repeated popups.

### Sequence

```text
1. Visit site
   proxy.ts seeds httpOnly agent_session cookie (UUID) if missing.

2. Create or restore agent wallet
   Create: POST /api/agent-wallet  (optional recovery address)
   Restore: connect publisher/recovery wallet → sign → POST /api/agent-wallet/recover
   Private key encrypted at rest (AGENT_WALLET_ENCRYPTION_KEY); never sent to the browser as raw key material after provision.

3. Fund Arc wallet
   Buyer sends Arc Testnet USDC to the agent wallet address
   (faucet: https://faucet.circle.com/).

4. Deposit to Gateway
   UI: Gateway deposit dialog / top-bar controls
   Server: POST /api/gateway/deposit  (session agent signs Gateway deposit)
   Until this step succeeds, unlocks return 402 with insufficient balance after signature path fails or client prechecks fail.

5. Browse catalog
   GET /api/marketplace/citations  (public teasers; no paid body)

6. Unlock a report
   Client: GET /api/marketplace/citations?id={listing}
   a. Server responds 402 + PAYMENT-REQUIRED (scheme exact, network eip155:5042002,
      asset Arc USDC, payTo = creator payout wallet or SELLER_ADDRESS).
   b. Client (or POST /api/gateway/pay for allowlisted paths) builds EIP-712
      TransferWithAuthorization against GatewayWalletBatched and retries with
      payment-signature header (base64 payment payload).
   c. withGateway → BatchFacilitatorClient.verify → .settle
   d. On success: recordPaymentEvent + recordCitationRoyalty (full amount to creator
      when fullToCreator); response 200 + markdown/JSON body.
   e. Client caches body in sessionStorage; prior unlocks for this agent wallet
      are also visible via creator_earnings on later catalog loads.

7. Creator payout
   On-chain: USDC already settled to payTo via Gateway batch.
   Off-chain: creator_earnings row (royalty_usdc, payer, gateway_tx, citation_id)
   for dashboard and “already unlocked” UX.

8. Optional: tip
   GET /api/marketplace/tip?username=&amount=  (same x402/Gateway path)
   payTo = profile tip_wallet if set, else payout_wallet, else post/publisher fallbacks.

9. Optional: back research (attestation)
   Approve USDC → Attestation.attest(target, amount) or POST /api/attestation
   for session agent. Platform fee (0.1 USDC) → immutable operator; stake locked
   to target. Claims index is Arcscan-first; agent stake uses multi-RPC fallback
   (503 only if rate-limited before broadcast — nothing staked, safe to retry).
```

### Sequence diagram

```mermaid
sequenceDiagram
  autonumber
  participant User
  participant UI as Marketplace UI
  participant Agent as Agent wallet API
  participant GW as Gateway deposit/pay
  participant API as citations?id=
  participant Fac as Circle facilitator
  participant Chain as Arc Gateway / USDC
  participant DB as Supabase

  User->>UI: Open marketplace
  UI->>Agent: Provision or restore session wallet
  User->>UI: Fund agent address (USDC)
  User->>GW: Deposit USDC into Gateway
  GW->>Chain: Gateway deposit
  User->>UI: Unlock report
  UI->>API: GET without payment
  API-->>UI: 402 + PAYMENT-REQUIRED
  UI->>GW: Sign TransferWithAuthorization (agent key)
  UI->>API: GET + payment-signature
  API->>Fac: verify + settle
  Fac->>Chain: batch settlement to payTo
  API->>DB: payment_events + creator_earnings
  API-->>UI: 200 + report body
  Note over DB: Creator sees royalty on dashboard; full unlock amount to payout_wallet
```

---

## Agent / CLI unlock path

`npm run agent -- "query"`:

1. Loads `BUYER_PRIVATE_KEY` as funder (not the in-app session wallet).
2. Funds an ephemeral or configured agent, deposits `DEPOSIT_AMOUNT` USDC to Gateway.
3. Searches catalog; optionally filters by TrustGate `--min-trust`.
4. Pays each selected citation via the same x402 headers against `BASE_URL`.
5. Prints synthesis with attribution.

See `agent.mts` and `lib/agent-gateway.ts`.

---

## Key modules for primitive extraction

| Concern | Files |
| --- | --- |
| x402 wrapper | `lib/x402.ts` |
| Payment memo / payee | `lib/payment-memo.ts`, `lib/payment-wallets.ts`, `lib/payment-payer.ts` |
| Gateway deposit / pay UI + server | `app/api/gateway/*`, `lib/gateway-metamask.ts`, `lib/gateway-pay.ts`, `components/dashboard/*gateway*` |
| Unlock client | `lib/citation-unlock-client.ts`, `lib/x402-client.ts` |
| Royalty record | `lib/royalties.ts`, `lib/record-payment-event.ts` |
| Attestation | `contracts/Attestation.sol`, `lib/attestation.ts`, `lib/attestation-client.ts`, `lib/attestation-index.ts` |

Citation-specific (must become pluggable in a standalone primitive): Supabase table shapes, catalog merge, TrustGate scoring, creator profiles.

---

## Deployed contracts (this project on Arc Testnet)

| Contract | Address | Notes |
| --- | --- | --- |
| Attestation | `0xc8886a68f2160a57a01b32aae542b6eec5ca3d02` | [Verified on Arcscan](https://testnet.arcscan.app/address/0xc8886a68f2160a57a01b32aae542b6eec5ca3d02#code) |
| USDC | `0x3600000000000000000000000000000000000000` | Arc Testnet USDC |
| Gateway wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | Circle GatewayWalletBatched |

Indexer start block: `48323587` (`ATTESTATION_DEPLOY_BLOCK`).

---

## Security notes for architecture readers

- Operator dashboard fee routes require a signature from `NEXT_PUBLIC_OPERATOR_ADDRESS`, not the deleted starter password cookie.
- Financial tables are service-role write; see Supabase migrations under `supabase/migrations/`.
- Never commit `*_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `AGENT_WALLET_ENCRYPTION_KEY`. See [SECURITY.md](../SECURITY.md) and `.env.example` headers.
