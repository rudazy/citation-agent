<div align="center">

<img src="app/icon.svg" width="72" height="72" alt="Citation Agent" />

# Citation Agent

**Researchers sell crypto research. Agents buy it.**

Paywalled research marketplace on Arc Testnet — x402 unlocks, optional reputation scoring, and on-chain research backing underneath.

[Arc Testnet](https://docs.arc.network) · [Circle Gateway](https://developers.circle.com) · [x402](https://www.x402.org)

</div>

---

## Overview

Citation Agent is a production-style reference for agentic commerce over paywalled knowledge. Analysts publish crypto research; humans and autonomous agents unlock reports with USDC via x402 and Circle Gateway. Settlement, reputation, and attestations are infrastructure — visible when needed, never the headline.

| Layer | What users see | What runs underneath |
| --- | --- | --- |
| **Catalog** | Browse, unlock, cite research | Markdown seeds + Supabase posts, catalog filter |
| **Commerce** | Per-report USDC unlock | x402 v2, Gateway batch settlement, royalty ledger |
| **Trust** | Optional score on cards | TrustGate arc-score (free) + paid verify (cached) |
| **Backing** | Stake behind a report or researcher | `Attestation.sol`, on-chain registry |
| **Agents** | CLI research loop | Session agent wallet, Gateway pay, trust-ranked citations |

Extended reference: [docs/platform-overview.md](docs/platform-overview.md)

---

## System architecture

```mermaid
flowchart TB
  subgraph Clients["Clients"]
    Human["Human · MetaMask"]
    Agent["Research agent CLI"]
    BrowserAgent["Browser · session agent wallet"]
  end

  subgraph Application["Application · Next.js"]
    Marketplace["/marketplace · catalog first"]
    Dashboard["/dashboard · settlement machinery"]
    APIs["API routes · x402 · attest · trust"]
  end

  subgraph Settlement["Settlement · Circle"]
    Facilitator["Batch facilitator"]
    GatewayAPI["Gateway API"]
    Relayer["Relayer"]
  end

  subgraph Chain["Arc Testnet · 5042002"]
    GatewayWallet["Gateway wallet"]
    USDC["USDC"]
    Attestation["Attestation.sol"]
  end

  subgraph Persistence["Persistence"]
    Supabase[("Supabase · posts · earnings · agent wallets")]
    Seeds["content/creators/*.md"]
  end

  Human --> Marketplace
  BrowserAgent --> Marketplace
  Agent --> APIs
  Marketplace --> APIs
  Dashboard --> APIs
  APIs --> Facilitator
  Facilitator --> GatewayAPI --> Relayer --> GatewayWallet
  APIs --> Attestation
  Attestation --> USDC
  APIs --> Seeds
  APIs --> Supabase
```

---

## Research unlock flow

Buyers fund a **Gateway balance** first. Unlock debits that balance — not the wallet directly. Agent-wallet unlocks are remembered across refresh via `creator_earnings`; the same browser session also caches bodies in `sessionStorage`.

```mermaid
sequenceDiagram
  autonumber
  participant Buyer as Buyer · agent or MetaMask
  participant UI as Marketplace catalog
  participant API as GET /api/marketplace/citations
  participant Fac as Circle facilitator
  participant GW as Gateway
  participant DB as Supabase

  Buyer->>UI: Unlock report
  UI->>API: GET ?id=listing
  API-->>Buyer: 402 + payment requirements
  Note over Buyer: EIP-712 TransferWithAuthorization
  Buyer->>API: Retry with payment-signature
  API->>Fac: verify and settle
  Fac->>GW: queue batch
  GW-->>API: settlement confirmed
  API->>DB: record creator_earnings
  API-->>Buyer: 200 + citation body
  Note over UI: Re-open catalog · no re-pay for same agent wallet
```

---

## Research backing and reputation

Backing is framed as commerce copy on catalog cards (`Back this research` / `Back this researcher`). Stakes are public on-chain claims grouped by canonical target (`author:…`, `citation:…`). Reputation is optional per card — free badge when configured, paid verify when the user opts in.

```mermaid
sequenceDiagram
  autonumber
  participant User
  participant Card as Catalog card
  participant Modal as Backing modal
  participant Chain as Attestation.sol
  participant Index as Claims indexer

  User->>Card: Back this researcher
  Card->>Modal: target author:Name
  alt Session agent wallet
    Modal->>Chain: attest via /api/attestation
  else MetaMask
    Modal->>Chain: approve + attest
  end
  Chain-->>Index: Attested event + getAttestations
  Index-->>Card: backer count · USDC total
  Note over Card: On-chain read fills index lag after refresh
```

---

## Stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 16, React 19, Tailwind CSS, shadcn/ui |
| Payments | x402 v2, Circle Gateway, viem |
| Attestations | Solidity, Foundry, Arc USDC |
| Chain | Arc Testnet (5042002) |
| Data | Supabase Postgres (publish, royalties, agent wallets, paid trust cache) |
| Deploy | Vercel |

---

## Quick start

**Prerequisites:** Node.js 22+, Arc Testnet USDC ([Circle faucet](https://faucet.circle.com/))

```cmd
npm install
copy .env.example .env.local
npm run generate-wallets
```

Fund the buyer address from the faucet. Configure attestation and Supabase variables (see `.env.example` and `.env.local.example`). Apply migrations in `supabase/migrations/` — including `20260625100000_paid_trust_cache.sql` for paid trust verify caching.

```cmd
npm run dev
```

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/marketplace` |
| `/marketplace` | Research catalog, unlock, backing, reputation, infrastructure layers |
| `/dashboard` | Payments, royalties, withdrawals, operator fees, settlement trace |

**Research agent**

```cmd
npm run agent -- "Hyperliquid market structure"
npm run agent -- "stablecoin yield" --min-trust 50
```

**Operator scripts** (dev server + env required)

```cmd
npx tsx scripts/generate-research-seeds.mts
npx tsx scripts/publish-research-posts.mts
npx tsx scripts/archive-catalog-noise.mts
```

**Smoke tests**

```cmd
npm run smoke:marketplace
npm run smoke:marketplace:full
```

---

## API summary

### Marketplace

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/marketplace/citations` | Public | Catalog metadata, backing stats, prior unlocks for session agent |
| `GET /api/marketplace/citations?id=` | x402 | Unlock body; records earnings |
| `GET /api/marketplace/citations?refresh=1` | Public | Bust attestation cache after new backing |
| `POST /api/marketplace/citations` | Wallet signature | Publish a post |

### Gateway and agent wallet

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /api/gateway/deposit` | Session agent | Deposit USDC into Gateway |
| `POST /api/gateway/pay` | Session agent | Pay allowlisted x402 paths |
| `GET /api/agent-wallet` | Session | Status; `POST` provisions per-browser wallet |

### Trust and backing

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/trustgate/score?postId=` | Public | Free or cached score |
| `POST /api/trustgate/score` | Payment proof | Paid verify; Supabase-backed cache |
| `POST /api/attestation` | Session agent | Server-side stake |
| `GET /api/attestation/claims` | Public | Registry; `?refresh=1` busts cache |

Catalog merges **markdown seeds** (`content/creators/`) and **Supabase posts** (`creator_posts`). Markdown seeds resolve trust identity to `NEXT_PUBLIC_OPERATOR_ADDRESS` unless `MARKETPLACE_IDENTITY_WALLET` is set.

---

## Environment

Copy [`.env.example`](.env.example) and [`.env.local.example`](.env.local.example).

| Variable | Purpose |
| --- | --- |
| `SELLER_ADDRESS` / `SELLER_PRIVATE_KEY` | Platform x402 payee; legacy seed fallback |
| `BUYER_ADDRESS` / `BUYER_PRIVATE_KEY` | CLI funder (`npm run agent`, `npm run attest`) |
| `ATTESTATION_ADDRESS` / `NEXT_PUBLIC_ATTESTATION_ADDRESS` | `Attestation.sol` |
| `ATTESTATION_DEPLOY_BLOCK` | Event indexer start block |
| `NEXT_PUBLIC_OPERATOR_ADDRESS` | Platform fee recipient; markdown seed trust identity |
| `ARC_TESTNET_RPC` / `GATEWAY_API` | Chain and Circle Gateway |
| `AGENT_WALLET_ENCRYPTION_KEY` | Encrypts per-session agent keys (32+ chars) |
| Supabase URL, anon key, `SUPABASE_SERVICE_ROLE_KEY` | Publish, royalties, agent wallets, paid trust cache |

**TrustGate (optional)**

| Variable | Purpose |
| --- | --- |
| `TRUSTGATE_SCORE_API_URL` | Free reader — use `trustgated.xyz/api/arc-score/{address}` |
| `TRUSTGATE_ORACLE_URL` | Paid verify — use `trustgated.xyz/api/oracle/{address}` (not direct oracle host) |
| `TRUSTGATE_PAID_CACHE_TTL_MS` | Paid score cache TTL (Supabase + memory) |

---

## Deployed contracts (Arc Testnet)

| Contract | Address |
| --- | --- |
| Attestation | `0xc8886a68f2160a57a01b32aae542b6eec5ca3d02` |
| USDC | `0x3600000000000000000000000000000000000000` |

Indexer start block: `48323587` (override with `ATTESTATION_DEPLOY_BLOCK` if redeployed).

[Verified on Arcscan](https://testnet.arcscan.app/address/0xc8886a68f2160a57a01b32aae542b6eec5ca3d02#code)

---

## Deploy

1. Connect the repository to [Vercel](https://vercel.com).
2. Set environment variables from `.env.example`.
3. Apply Supabase migrations on the production project.
4. Deploy from `main`.

Post-deploy: confirm `/llms.txt` is reachable and marketplace catalog loads with research listings.

---

## Security

- **Testnet only.** Do not reuse generated keys on mainnet.
- Private keys remain server-side; never expose them to the client.
- See [`SECURITY.md`](SECURITY.md) for reporting.

---

## License

Apache-2.0. Portions derived from the [arc-nanopayments](https://github.com/circlefin/arc-nanopayments) starter (Circle Internet Group, Inc.).