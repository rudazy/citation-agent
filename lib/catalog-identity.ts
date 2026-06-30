/**
 * Resolve which wallet TrustGate should score for a catalog listing.
 *
 * Database posts use the wallet that signed publish. Markdown demo seeds ship
 * with fictional author_wallet values for persona variety; when a marketplace
 * operator publishes everything from one wallet, trust must still score that
 * operator — not the placeholder address baked into the seed file.
 */

import { getAddress } from "viem";
import type { CreatorContent } from "@/lib/citations";

const ZERO = "0x0000000000000000000000000000000000000000";

function normalizeWallet(value: string | undefined): `0x${string}` | null {
  if (!value?.trim()) return null;
  try {
    return getAddress(value.trim());
  } catch {
    return null;
  }
}

/** Optional override; falls back to NEXT_PUBLIC_OPERATOR_ADDRESS for markdown seeds. */
export function marketplaceIdentityWallet(): `0x${string}` | null {
  const explicit = normalizeWallet(process.env.MARKETPLACE_IDENTITY_WALLET);
  if (explicit && explicit.toLowerCase() !== ZERO) return explicit;

  const operator = normalizeWallet(process.env.NEXT_PUBLIC_OPERATOR_ADDRESS);
  if (operator && operator.toLowerCase() !== ZERO) return operator;

  return null;
}

/**
 * Wallet to score for database posts — the wallet that signed publish.
 */
export function resolvePublisherTrustWallet(item: CreatorContent): `0x${string}` {
  return item.connectedWallet;
}

/**
 * Wallet to use for TrustGate lookups (free catalog badge + paid verify).
 * DB posts: signing wallet. Markdown seeds: operator / env override.
 */
export function resolveTrustIdentityWallet(item: CreatorContent): `0x${string}` {
  if (item.source === "database") {
    return item.connectedWallet;
  }

  const catalogIdentity = marketplaceIdentityWallet();
  if (catalogIdentity) return catalogIdentity;

  return item.connectedWallet;
}