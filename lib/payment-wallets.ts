import { getAgentWalletAddress, isAgentWalletConfigured } from "@/lib/agent-wallet";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function normalizeAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !ADDRESS_RE.test(value)) return null;
  return value as `0x${string}`;
}

/** Payment recipient for x402 routes. Must differ from the agent (buyer) wallet. */
export function getSellerAddress(): `0x${string}` | null {
  return normalizeAddress(process.env.SELLER_ADDRESS);
}

export function getBuyerAddress(): `0x${string}` | null {
  return getAgentWalletAddress();
}

export function hasDistinctPaymentWallets(): boolean {
  const seller = getSellerAddress();
  const buyer = getBuyerAddress();
  return Boolean(seller && buyer && seller.toLowerCase() !== buyer.toLowerCase());
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
  return isSellerConfigured() && isAgentWalletConfigured();
}

export function sellerConfigError(): string | null {
  if (!isAgentWalletConfigured()) {
    return "Agent wallet not configured. Run npm run generate-wallets or create an agent wallet in the app.";
  }
  if (!getSellerAddress()) {
    return "SELLER_ADDRESS not configured. Run npm run generate-wallets — existing buyer keys are preserved and only seller keys are added.";
  }
  if (!hasDistinctPaymentWallets()) {
    return "SELLER_ADDRESS must differ from the agent (buyer) wallet. Run npm run generate-wallets to add a separate seller wallet.";
  }
  return null;
}