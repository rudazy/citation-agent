# Citation Agent — Product Roadmap

> **Citation Agent is the marketplace where trusted knowledge becomes a programmable asset for both humans and AI.**

Live product: [agentcitation.xyz](https://agentcitation.xyz)  
Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md) · Platform overview: [platform-overview.md](./platform-overview.md)

This document is the **public product roadmap**. It explains where the product is today, where it is going, and how each phase compounds into a single category: a **judgment marketplace** for crypto — not another feed, not a generic creator social app.

---

## Vision

### The problem

Crypto decisions are made under uncertainty. People look to analysts, YouTubers, traders, KOLs, founders, and newsletters for guidance — but:

- Judgment is scattered across X, YouTube, Substack, and group chats
- Reputation is measured in followers and impressions, not outcomes
- AI agents cannot cleanly buy or cite structured conviction
- High-signal research is hard to price, stake, and settle

### The shift

| Old framing | Direction |
| --- | --- |
| A place to publish paid articles | A marketplace for **judgment** |
| Researchers only | Anyone whose **conviction** has value |
| Followers as status | **Proof of judgment** as status |
| Content as the product | Judgment as a **programmable asset** |

People do not primarily create “articles.” They create **judgment** — conviction under uncertainty — in different formats:

| Creator type | Format they already use | What becomes the asset here |
| --- | --- | --- |
| Analyst | Research report | Deep, priced research |
| YouTuber | Video opinion / thesis | Structured signals + endorsements (no video re-upload) |
| Trader | Position / thesis | Signals with horizon and invalidation |
| KOL | Recommendation | Curation desk + endorsement royalties |
| Newsletter | Issue / brief | Packs, memberships, research |
| Fund / firm | Multi-author output | Shared Creator Desk |

**Creator promise:**

> Bring your judgment. Keep your audience. Earn whenever humans or AI act on your ideas.

**Behavior we want as default:**

> “If you want to know who to trust in crypto, check their Citation Desk.”

### Feature filter

Every roadmap item must make judgment more **valuable**, more **trustworthy**, or easier to **monetize**. If it does not, it is out of scope.

---

## Product principles

1. **Judgment is the scarce asset.** Reports, signals, endorsements, and feeds are containers — not competing products.
2. **Desks are the home.** Profiles identify people; **Creator Desks** hold their business of research, signals, stamps, memberships, and track record.
3. **Dual demand.** Humans and AI agents are first-class buyers. Agent commerce is not a side demo.
4. **Proof over attention.** Creator Score and track record beat follower counts.
5. **Keep audiences where they already live.** Content can stay on YouTube, X, or Substack. Conviction settles on Citation Agent.
6. **Ship on real rails.** USDC unlocks, royalties, stake/attestations, and TrustGate remain the settlement and trust layer.
7. **Niche first.** Crypto judgment only until density is undeniable. No multi-vertical expansion for its own sake.
8. **Phase discipline.** Finish and learn from each phase before jumping ahead.

---

## Language standards (public)

| Prefer | Avoid |
| --- | --- |
| Judgment marketplace / knowledge assets | “Just a paywall” / blog host |
| Creator Desk | Generic “profile only” as the product |
| Unlock | Vague “subscribe” without settlement meaning |
| Proof of judgment / Creator Score | Vanity follower metrics as the main status |
| Signal / conviction | Empty hot take with no structure |
| Endorsement / stamp | Like button economics |
| Research asset | Disposable post |
| Humans and AI buyers | “AI agent platform” as the whole identity |

---

## What is live today (foundation)

The settlement and marketplace foundation is already shipping on Arc Testnet. Future phases build on these rails rather than replacing them.

| Capability | Status |
| --- | --- |
| Paywalled research catalog (seeds + published posts) | Live |
| USDC unlocks via x402 + Circle Gateway | Live |
| Creator royalties / earnings ledger | Live |
| Session agent wallets + restore | Live |
| Publish flow (drafts, schedule, covers, markdown tools) | Live |
| Public profiles (`/u/@name`), tips, follows | Live |
| Report share landings (`/r/{id}`) | Live |
| Threaded comments (unlock-gated) | Live |
| TrustGate scores on cards | Live |
| USDC attestations / research backing | Live |
| Dashboard (royalties, claims, settlement visibility) | Live |
| Link verification on profiles | Live |

**North star already in motion:** research is buyable by humans and agents, with payout and trust infrastructure under it.

---

## Where we are going (judgment layer)

The next product layer turns “paid research marketplace” into **judgment infrastructure**.

### Creator Desk (center of the product)

Every creator owns a **Desk** — their judgment business, not only a bio page.

A Desk can hold:

- Research articles (deep unlockable work)
- **Signal Cards** (thesis, direction, confidence, horizon, invalidation)
- Curated research from others
- **Endorsements** (stamps on work they stand behind)
- Memberships / desk access
- AI-readable feeds
- Performance history / track record

| Creator type | Natural Desk mode |
| --- | --- |
| Researcher | Reports + optional signals |
| YouTuber | Signals + endorsements (videos stay on YouTube) |
| Trader | Positions with horizons and invalidations |
| KOL | Curation + stamp royalties |
| Newsletter | Packs + membership |
| Research firm | Multi-author desk with revenue splits |

### Signal Cards

Structured conviction humans and agents can unlock — without forcing long-form writing or video uploads.

### Endorsements

Respected desks stamp research or signals. When a stamp drives an unlock, curators can earn a share. Taste becomes an economic graph.

### Creator Score (Proof of Judgment)

Public, methodology-visible reputation built from outcomes and economics — not followers. Illustrative components:

- Thesis accuracy (where claims resolve)
- Economic impact of endorsements
- AI / agent unlocks
- Human buyers and retention
- Earnings
- Attestation / stake quality

**Design rule:** ship transparent component metrics before a single opaque composite.

### Daily demand surfaces

Creators follow buyers. The product needs reasons to open daily:

- What agents bought today
- Top performing Desks
- Biggest conviction changes
- Most accurate creators this period
- Signals that just resolved

### Challenges

Time-boxed judgment contests (e.g. best thesis of the month, overlooked protocol, next narrative). Submissions, unlocks, agent ranking, prizes, featured placement, score impact, badges.

### First-win activation

A new creator should, in minutes:

1. Claim identity  
2. Open a Desk  
3. Publish one Signal  
4. Share it  
5. Earn a first tip or unlock  

---

## Phased roadmap

### Phase 0 — Foundation (largely complete)

*Settlement, publish, trust rails*

| Item | Notes |
| --- | --- |
| Marketplace unlocks (humans + agents) | x402 + Gateway USDC |
| Creator publish + royalties | Payout wallets, earnings |
| Profiles, tips, follows, comments | Social layer without becoming a generic feed |
| TrustGate + attestations | Trust and skin-in-the-game |
| Shareable report pages | `/r/{id}` distribution |

**Exit criteria:** A creator can publish research, a human or agent can unlock it, and settlement + trust signals are visible.

**Status:** Core complete on Arc Testnet; polish and reliability continue.

---

### Phase 1 — Creator Desks + Signal economy

*Belonging, multi-format judgment, fast first win*

- [x] **Creator Desks** as the primary home (research + signals + stamps + track record shell)
- [x] **Signal Cards** (structured thesis objects; priced unlock or board access)
- [x] Identity claim UX (link X / YouTube / site on top of existing verification)
- [x] Five-minute onboarding path: claim → Desk → one Signal → share
- [x] Outbound share kit (Desk + signal links for X / YouTube descriptions)
- [x] Desk-facing analytics v1 (unlocks, revenue; human vs agent demand deferred)
- [x] Import / paste path for existing written work (verified listing, no scrape-without-claim)

**North star:** Creators of more than one type open Desks and post a first Signal without writing a full report.

**Exit:** Non-researcher creators can earn or get meaningful attention from judgment objects, not only long-form posts.

**Status (July 2026):** MVP shipped on Arc Testnet rails — Desks shell on `/u/{username}`, Signal publish + same x402 unlock as research, YouTube verification kind, share kits, desk analytics rollup. Endorsements / stamps economics remain Phase 2.

---

### Phase 2 — Demand habit + endorsement graph

*Why buyers and agents open the product daily*

- [ ] Demand surfaces: agent purchases, top Desks, conviction changes, resolutions
- [ ] **Endorsements** with curator economics when stamps convert to unlocks
- [ ] Referral attribution (audience owner earns when they route unlocks)
- [ ] Follow + notify when a followed Desk publishes a signal or report
- [ ] Niche discovery (sectors / themes) and rising-desk lane
- [ ] Lightweight weekly rhythm (e.g. top signals, scoreboard of resolutions)

**North star:** Repeat human buyers + repeat agent unlocks without requiring new creator spam.

**Exit:** Daily/weekly demand loops exist; endorsement graph produces discovery edges.

---

### Phase 3 — Proof of Judgment + Challenges

*Reputation that compounds; recurring participation*

- [ ] **Creator Score** components (accuracy, demand, endorsement impact, retention, stake quality)
- [ ] Public methodology and anti-sybil / anti-wash rules
- [ ] Signal resolution / outcome logging (right / wrong / void / open)
- [ ] **Challenges** (themed contests, prizes, featured placement, badges, score boost)
- [ ] Leaderboards by Proof of Judgment dimensions (not vanity alone)
- [ ] Version history and richer research asset pages (revenue, citations, AI vs human)

**North star:** People check a Citation Desk before trusting a public crypto take.

**Exit:** Creator Score is understandable, hard enough to game, and used in discovery ranking.

---

### Phase 4 — Memberships, teams, agent API product

*Business depth for desks and machines*

- [ ] Desk memberships / board passes (recurring access, not only à-la-carte)
- [ ] Multi-author Desks, roles, and revenue splits
- [ ] Co-author and desk-cut settlement
- [ ] First-class **Signal / Desk API** for agents (discover, unlock, cite, metadata)
- [ ] Simple license tiers (human read, agent read, cite; train/redistribute later)
- [ ] Collections / bundles of research and signals
- [ ] Research requests / bounties (buyer posts a paid ask; desks compete)

**North star:** Desks operate as knowledge businesses; agents integrate via stable APIs.

**Exit:** Team desks earn via splits; agent API volume is a reported metric.

---

### Phase 5 — Access and growth

*Lower friction without abandoning crypto settlement*

- [ ] Smoother first-session funding UX (human language; rails stay USDC/Gateway)
- [ ] Fiat / card path for human unlocks where it increases conversion
- [ ] Optional email or social login **in addition to** wallet flows (payouts still wallet-settled)
- [ ] Pro desk tiers (limits, priority placement, request priority)
- [ ] Deeper distribution embeds (newsletter/site unlock teasers)

**North star:** Higher conversion from web2-native readers without diluting agent-native settlement.

**Exit:** Onboarding drop-off falls; Pro and fiat share are measurable.

---

## Monetization (directional)

| Stream | Phase | Notes |
| --- | --- | --- |
| Research / signal unlocks | Live → expand | Creator-earned USDC; marketplace economics evolve carefully |
| Tips | Live | Direct support to creators |
| Attestation fees | Live | Platform fee on stake |
| Endorsement / referral cuts | Phase 2 | Curators and distributors earn when they convert demand |
| Desk memberships | Phase 4 | Recurring desk access |
| Agent API usage | Phase 4 | Machine-native demand |
| Pro desk plans | Phase 5 | Higher limits / priority |
| Challenges sponsorship / prizes | Phase 3 | Optional growth surface |

Platform take rates, if expanded beyond current attestation fees, must stay transparent and creator-aligned.

---

## Success metrics by phase

| Phase | Primary signals |
| --- | --- |
| 0 | Paid unlocks, creator earnings, agent unlocks, successful publishes |
| 1 | Desks created, Signals published, time-to-first-signal, non-researcher creators active |
| 2 | DAU/WAU buyers, repeat unlocks, endorsement-attributed revenue, agent repeat demand |
| 3 | Creator Score usage in discovery, resolved signals, Challenge participation |
| 4 | Membership MRR, multi-author desk GMV, API unlock volume |
| 5 | Activation rate, fiat unlock share, Pro conversion |

**Do not optimize for creator signups alone.** Optimize for paid judgment, repeat demand, and trustworthy reputation.

---

## Explicitly not on the roadmap

Out of scope until a deliberate post-traction review:

- Becoming LinkedIn / Substack / X with a wallet glued on
- Video hosting (videos stay on YouTube and similar)
- General social feed optimized for vanity engagement
- Multi-vertical expansion (sports, entertainment, etc.) before crypto density
- DAO / governance token as a product shortcut
- Auto-scrape of others’ work without creator claim and verification
- Mystery reputation scores with no methodology
- Gamification that mints worthless signals

---

## Competitive position (why this is hard to copy)

| Layer | What competitors usually have | What Citation Agent compounds |
| --- | --- | --- |
| Attention | X, YouTube, newsletters | Not competing for minutes — routing intent |
| Publishing | Substack, Mirror | Research is one judgment object among several |
| Payments | Cards, memberships | USDC unlocks + agent-native payment (x402 / Gateway) |
| Trust | Follower counts | Stake, attestations, TrustGate, outcome-linked score |
| Machines | Scraping and plugins | Paid, structured, licensed judgment feeds |

The moat is the **stack**: settlement + stake + dual demand + desk graph + Proof of Judgment.

---

## One-page summary for judges and visitors

| Question | Answer |
| --- | --- |
| What is it today? | Crypto research marketplace on Arc Testnet: humans and agents unlock paid knowledge with USDC; creators earn; trust via scores and attestations |
| What is it becoming? | A **judgment marketplace** where desks sell research, signals, curation, and reputation as programmable assets |
| Who is it for? | Researchers, traders, YouTubers, KOLs, newsletters, funds — anyone with valuable conviction |
| What do creators sell? | Judgment — not “content for content’s sake” |
| What do buyers get? | Priced, attributable, increasingly scorable conviction for decisions and agent workflows |
| What should people say? | “Check their Citation Desk.” |
| What is next? | Desks → Signals → demand loops → Creator Score → Challenges → memberships & agent API |

---

## Related docs

- [Architecture](./ARCHITECTURE.md) — unlock sequence and system layers  
- [Platform overview](./platform-overview.md) — current live behavior and stack  

---

*Last updated: July 2026. Public roadmap for product direction and evaluation. Implementation order may adjust after real creator and buyer learning; category direction (judgment marketplace, Desks, Proof of Judgment) is intentional.*
