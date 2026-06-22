import { isCliFunderConfigured } from "@/lib/agent-wallet";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function normalizeAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !ADDRESS_RE.test(value)) return null;
  return value as `0x${string}`;
}

/** Payment recipient for x402 routes. Must differ from CLI funder wallet. */
export function getSellerAddress(): `0x${string}` | null {
  return normalizeAddress(process.env.SELLER_ADDRESS);
}

/** CLI funder address (npm run agent) — not in-app user wallets. */
export function getCliFunderAddress(): `0x${string}` | null {
  return normalizeAddress(process.env.BUYER_ADDRESS);
}

/** @deprecated Use getCliFunderAddress */
export function getBuyerAddress(): `0x${string}` | null {
  return getCliFunderAddress();
}

export function hasDistinctPaymentWallets(): boolean {
  const seller = getSellerAddress();
  const funder = getCliFunderAddress();
  if (!seller) return false;
  if (!funder) return true;
  return seller.toLowerCase() !== funder.toLowerCase();
}

export function getSellerPrivateKey(): `0x${string}` | null {
  const key = process.env.SELLER_PRIVATE_KEY;
  if (!key || key.includes("YourSeller")) return null;
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

export function isSellerConfigured(): boolean {
  return getSellerAddress() !== null;
}

export function isPaymentStackConfigured(): boolean {
  return isSellerConfigured();
}

export function sellerConfigError(): string | null {
  if (!getSellerAddress()) {
    return "SELLER_ADDRESS not configured. Run npm run generate-wallets — existing buyer keys are preserved and only seller keys are added.";
  }
  if (
    isCliFunderConfigured() &&
    getCliFunderAddress() &&
    getSellerAddress()?.toLowerCase() === getCliFunderAddress()?.toLowerCase()
  ) {
    return "SELLER_ADDRESS must differ from BUYER_ADDRESS (CLI funder). Run npm run generate-wallets.";
  }
  return null;
}