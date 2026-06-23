/**
 * Marketplace end-to-end smoke (Days 1–3). Dev server must be running.
 *
 * Quick (no on-chain spend):
 *   node --experimental-transform-types --no-warnings --env-file=.env.local scripts/smoke-marketplace.mts
 *
 * Full (publish + paid unlock; uses BUYER_PRIVATE_KEY, spends USDC):
 *   node --experimental-transform-types --no-warnings --env-file=.env.local scripts/smoke-marketplace.mts --full
 */

import { fileURLToPath } from "node:url";
import { privateKeyToAccount } from "viem/accounts";
import { publishMessage } from "../lib/publish-auth.ts";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const WALLET_KEYS = ["author_wallet", "connected_wallet", "payout_wallet", "wallet", "address"];
const PUBLISH_PREFIX = "Citation Agent publish";

const full = process.argv.includes("--full");

function step(label: string): void {
  console.log(`\n▸ ${label}`);
}

async function assertServerUp(): Promise<void> {
  step("Server reachable");
  const res = await fetch(`${BASE_URL}/api/dashboard/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status}). Run: npm run dev`);
  const health = (await res.json()) as { supabase?: { ready?: boolean } };
  console.log(`  health OK (supabase ready: ${health.supabase?.ready ?? false})`);
}

async function assertCatalogGating(): Promise<string> {
  step("Day 1+3 — catalog gating (no wallet, no body)");
  const res = await fetch(`${BASE_URL}/api/marketplace/citations`);
  if (!res.ok) throw new Error(`Catalog GET failed (${res.status})`);
  const data = (await res.json()) as {
    listings?: Record<string, unknown>[];
    trust_lookup_endpoint?: string;
  };
  const listings = data.listings ?? [];
  if (listings.length === 0) throw new Error("No listings — publish a post or check Supabase");

  for (const row of listings) {
    for (const key of WALLET_KEYS) {
      if (key in row && row[key] != null) {
        throw new Error(`Catalog leaks "${key}" on ${row.id}`);
      }
    }
    if ("body" in row && row.body != null) {
      throw new Error(`Catalog leaks body on ${row.id}`);
    }
    if (typeof row.paid_count !== "number") {
      throw new Error(`Missing paid_count on ${row.id}`);
    }
    if (typeof row.subheading !== "string") {
      throw new Error(`Missing subheading on ${row.id}`);
    }
    if (row.trust != null && typeof row.trust === "object") {
      const t = row.trust as Record<string, unknown>;
      for (const key of WALLET_KEYS) {
        if (key in t) throw new Error(`Trust object leaks ${key}`);
      }
    }
  }

  const sampleId = String(listings[0].id);
  console.log(`  ${listings.length} listings OK (sample: ${sampleId})`);
  return sampleId;
}

async function assertTrustByPostId(postId: string): Promise<void> {
  step("Day 3 — trust lookup by postId (wallet hidden)");
  const res = await fetch(
    `${BASE_URL}/api/trustgate/score?postId=${encodeURIComponent(postId)}`,
  );
  const data = (await res.json()) as Record<string, unknown>;
  const text = JSON.stringify(data).toLowerCase();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key);
    const { data: row } = await supabase
      .from("creator_posts")
      .select("connected_wallet")
      .eq("id", postId)
      .maybeSingle();
    if (row?.connected_wallet && text.includes(String(row.connected_wallet).toLowerCase())) {
      throw new Error("Trust response leaked connected_wallet");
    }
  }

  if (!["cached", "challenge", "unconfigured", "error"].includes(String(data.status))) {
    throw new Error(`Unexpected trust status: ${String(data.status)}`);
  }
  console.log(`  trust status=${data.status} (no wallet in response)`);
}

async function assertPublishAuth(): Promise<void> {
  step("Day 1 — unsigned publish rejected");
  const res = await fetch(`${BASE_URL}/api/marketplace/citations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Should fail",
      subheading: "No signature on this request",
      body: "This must not be saved to the database ever",
      price_usdc: "0.001",
    }),
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  console.log("  unsigned POST → 401");
}

async function assertUnpaidUnlockBlocked(postId: string): Promise<void> {
  step("Day 2 — unpaid unlock blocked");
  const res = await fetch(
    `${BASE_URL}/api/marketplace/citations?id=${encodeURIComponent(postId)}`,
  );
  const text = await res.text();
  if (res.status !== 402) throw new Error(`Expected 402, got ${res.status}`);
  if (text.includes("SECRET PAYWALLED") || text.length > 500) {
    throw new Error("Unpaid response may leak body");
  }
  console.log("  unpaid ?id= → 402, no body");
}

async function assertPaidUnlock(postId: string): Promise<void> {
  step("Day 2 — paid unlock releases body");
  const raw = process.env.BUYER_PRIVATE_KEY;
  if (!raw) throw new Error("BUYER_PRIVATE_KEY required for --full");

  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  const gateway = new GatewayClient({ chain: "arcTestnet", privateKey: key });
  const url = `${BASE_URL}/api/marketplace/citations?id=${encodeURIComponent(postId)}`;

  const result = await gateway.pay<{ citation?: { body?: string } }>(url, { method: "GET" });
  const body = result.data?.citation?.body;
  if (!body) throw new Error("Paid unlock missing body");
  console.log(`  paid ${result.formattedAmount} USDC, body ${body.length} chars`);

  const catalog = await fetch(`${BASE_URL}/api/marketplace/citations`);
  const catalogData = (await catalog.json()) as { listings?: Record<string, unknown>[] };
  const row = catalogData.listings?.find((l) => l.id === postId);
  if (row && "body" in row) throw new Error("Catalog leaked body after unlock");
  console.log("  catalog still gated after unlock");
}

async function assertSignedPublish(): Promise<string | null> {
  if (!full) return null;

  step("Day 1 — signed publish");
  const raw = process.env.BUYER_PRIVATE_KEY;
  if (!raw) throw new Error("BUYER_PRIVATE_KEY required for --full");

  const account = privateKeyToAccount(
    (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`,
  );
  const timestamp = Date.now().toString();
  const message = `${PUBLISH_PREFIX} ${timestamp}`;
  const signature = await account.signMessage({ message });

  const title = `E2E smoke ${new Date().toISOString().slice(11, 19)}`;
  const res = await fetch(`${BASE_URL}/api/marketplace/citations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-publish-address": account.address,
      "x-publish-timestamp": timestamp,
      "x-publish-signature": signature,
    },
    body: JSON.stringify({
      title,
      subheading: "E2E public teaser — body stays server-side until Expand.",
      body: "E2E PAYWALLED BODY — must not appear in catalog JSON.",
      price_usdc: "0.001",
      tags: ["e2e-smoke"],
    }),
  });
  const data = (await res.json()) as { post?: { id: string }; error?: string };
  if (!res.ok) throw new Error(`Publish failed: ${data.error ?? res.status}`);
  console.log(`  published ${data.post?.id}`);
  return data.post?.id ?? null;
}

function printBrowserChecklist(): void {
  console.log(`
────────────────────────────────────────
Local browser checklist (http://localhost:3000/marketplace)

1. Publish paid content — connect wallet, sign, submit post
2. Catalog card — subheading visible, trust badge, paid count, NO body, NO wallet
3. Expand — pay post price, full body appears
4. Refresh trust (if oracle configured) — pays 0.001 USDC, score updates, wallet still hidden
5. Attest citation / author — optional on-chain stake

Prereqs: .env.local with Supabase + SELLER_ADDRESS + BUYER keys; Arc Testnet in MetaMask.
On-chain tests (--full) need funded BUYER wallet on Arc.
────────────────────────────────────────`);
}

async function main(): Promise<void> {
  console.log(`Marketplace smoke @ ${BASE_URL}${full ? " (full)" : " (quick)"}`);

  await assertServerUp();
  await assertPublishAuth();

  let postId = await assertCatalogGating();
  await assertTrustByPostId(postId);
  await assertUnpaidUnlockBlocked(postId);

  const newId = await assertSignedPublish();
  if (newId) postId = newId;

  if (full) {
    await assertPaidUnlock(postId);
  } else {
    console.log("\n  (skip paid unlock — pass --full to test on-chain Expand)");
  }

  console.log("\nPASS: marketplace smoke complete");
  printBrowserChecklist();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error("\nFAIL:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}