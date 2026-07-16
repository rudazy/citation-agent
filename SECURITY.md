# Security Policy

## Scope

Citation Agent is open source under Apache-2.0. It runs on **Arc Testnet** and uses testnet USDC. Treat every private key, service role key, and encryption secret as production-grade credentials even on testnet.

Portions of this repository are derived from Circle's [arc-nanopayments](https://github.com/circlefin/arc-nanopayments) starter. That does **not** mean Circle operates or secures this deployment. Report issues for **this** project as described below.

## Reporting a vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Email the maintainer privately with:

- A short description of the issue and impact
- Steps to reproduce (or a minimal proof of concept)
- Affected paths, versions, or deployment URLs if known

Contact: the GitHub account that owns this repository ([rudazy](https://github.com/rudazy)) via a private channel (GitHub Security Advisories preferred when available).

You should receive an acknowledgement when the report is received. Please allow reasonable time for investigation before any public disclosure.

## Secrets and keys

- Never commit `.env`, `.env.local`, or any file containing real keys.
- Private keys (`*_PRIVATE_KEY`), `SUPABASE_SERVICE_ROLE_KEY`, `AGENT_WALLET_ENCRYPTION_KEY`, and API tokens must live only in local env files or the host secret store (e.g. Vercel env).
- Placeholders in `.env.example` are not real credentials. Do not paste production or testnet keys into docs, issues, or chat logs.
- If a key is exposed, rotate it immediately and treat any funded wallet as compromised.

## Testnet note

Arc Testnet funds have limited real-world value, but leaked keys still enable wallet drain, session wallet decryption (if the encryption key leaks), and abuse of operator APIs. Rotate and redeploy secrets the same way you would on mainnet.
