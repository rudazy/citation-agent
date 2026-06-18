# Citation Agent

Citation-paying research agent built on [Circle Nanopayments](https://www.circle.com/nanopayments) and the official [arc-nanopayments](https://github.com/circlefin/arc-nanopayments) starter. Research agents discover paywalled creator content, pay per citation via x402 on Arc Testnet, and attribute royalties (70% creator / 30% platform) with verifiable payment provenance.

## Features

- **Pay-per-citation research** — agents query creator markdown sources and pay micro-royalties per cited passage
- **x402 + Circle Gateway** — gasless batched USDC nanopayments on Arc Testnet (chain ID 5042002)
- **Creator earnings dashboard** — real-time royalty ledger and agent reputation scores in Supabase
- **Exclusive attribution** — synthesized answers include paid citation credits, not hallucinated sources

## Prerequisites

- Node.js v22+
- Supabase project (cloud) or Docker Desktop (local Supabase)
- Arc Testnet USDC in the buyer wallet via [Circle faucet](https://faucet.circle.com/)

## Quick Start

```cmd
npm.cmd install
copy .env.example .env.local
npm.cmd run generate-wallets
```

Fund the buyer wallet printed by `generate-wallets` at the Circle faucet.

### Supabase (remote)

1. Create a project at [supabase.com](https://supabase.com)
2. Add URL and keys to `.env.local`
3. Push migrations:

```cmd
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### Run

```cmd
npm.cmd run dev
```

Dashboard: `http://localhost:3000/dashboard` (demo login: `admin@example.com` / `123456`)

### Research agent (citation payments)

```cmd
npm.cmd run agent -- "How do nanopayments enable trust infrastructure?"
```

### Loop agent (throughput demo)

```cmd
npm.cmd run agent
```

## Paywalled Endpoints

| Endpoint | Method | Price | Description |
| --- | --- | --- | --- |
| `/api/premium/citation?id=<id>` | GET | $0.001 | Paid creator citation with royalty split |
| `/api/premium/citation/index` | GET | Free | Citation catalog for agents |
| `/api/premium/quote` | GET | $0.001 | Inspirational quote |
| `/api/premium/dataset` | GET | $0.01 | Sample analytics dataset |
| `/api/premium/compute` | POST | $0.0003 | Text analysis |
| `/api/premium/agent-task` | GET | $0.03 | Treasure hunt clue |

## Creator Content

Markdown sources live in `content/creators/` with frontmatter metadata (`title`, `author`, `author_wallet`, `price_usdc`, `tags`).

## Environment Variables

See `.env.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SELLER_ADDRESS`, `SELLER_PRIVATE_KEY`
- `BUYER_ADDRESS`, `BUYER_PRIVATE_KEY`

Optional: `OPENAI_API_KEY` for future LLM-driven routing.

## Arc Testnet notes

Friction observed while building:

1. **Buyer wallet funding** — faucet flow is smooth, but first-time builders may not realize Arc gas is native USDC (18 decimals) separate from ERC-20 USDC (6 decimals). The starter handles this; documenting it earlier in the README would help.
2. **Nonce collisions** — parallel agents funding from one buyer wallet need retry logic (included in `agent.mts`).
3. **Supabase required for dashboard** — payment settlement works without DB, but royalty attribution needs migrations pushed before demo.
4. **Gateway deposit latency** — agents should deposit before citation bursts; a `--preflight` health check would reduce demo failures.

## Deploy

Connect `rudazy/citation-agent` to Vercel, set environment variables, deploy from `main`.

## Security

Testnet only. Do not use generated keys on mainnet. `.env.local` is gitignored.