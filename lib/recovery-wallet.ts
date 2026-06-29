import { normalizeWalletAddress } from "@/lib/publish-auth";

/** Parse a user-pasted MetaMask recovery address (no signature). */
export function parseRecoveryWallet(value: unknown): `0x${string}` | null {
  if (typeof value !== "string") return null;
  return normalizeWalletAddress(value.trim());
}