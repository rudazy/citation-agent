import { getAddress, verifyMessage } from "viem";
import { consumeAuthSignature } from "@/lib/signature-replay-store";
import { normalizeWalletAddress } from "@/lib/publish-auth";

export const LINK_MESSAGE_PREFIX = "Citation Agent link agent wallet";
export const RESTORE_LINKED_MESSAGE_PREFIX = "Citation Agent restore agent wallet";

export const WALLET_LINK_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

export function linkMessage(agentAddress: string, timestamp: string): string {
  return `${LINK_MESSAGE_PREFIX} ${getAddress(agentAddress)} ${timestamp}`;
}

export function restoreByLinkedMessage(timestamp: string): string {
  return `${RESTORE_LINKED_MESSAGE_PREFIX} ${timestamp}`;
}

type WalletAuthHeaders = {
  wallet: `0x${string}` | null;
  timestamp: string | null;
  signature: string | null;
};

function readWalletAuthHeaders(
  request: Request,
  prefix: "link" | "recover",
): WalletAuthHeaders {
  const wallet = normalizeWalletAddress(
    request.headers.get(prefix === "link" ? "x-link-wallet" : "x-recover-wallet") ?? "",
  );
  const timestamp = request.headers.get(
    prefix === "link" ? "x-link-timestamp" : "x-recover-timestamp",
  );
  const signature = request.headers.get(
    prefix === "link" ? "x-link-signature" : "x-recover-signature",
  );
  return { wallet, timestamp, signature };
}

function isFreshTimestamp(timestamp: string): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  return Number.isFinite(ts) && Math.abs(Date.now() - ts) <= WALLET_LINK_AUTH_MAX_AGE_MS;
}

export type VerifiedLinkRequest = {
  agentAddress: `0x${string}`;
  linkedWallet: `0x${string}`;
};

export async function verifyLinkRequest(
  request: Request,
  expectedAgentAddress: `0x${string}`,
): Promise<VerifiedLinkRequest | null> {
  const { wallet: linkedWallet, timestamp, signature } = readWalletAuthHeaders(request, "link");
  if (!linkedWallet || !timestamp || !signature || !isFreshTimestamp(timestamp)) return null;

  let agentAddress: `0x${string}`;
  try {
    agentAddress = getAddress(expectedAgentAddress);
  } catch {
    return null;
  }

  const message = linkMessage(agentAddress, timestamp);

  try {
    const valid = await verifyMessage({
      address: linkedWallet,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return null;

    const consumed = await consumeAuthSignature(
      "agent-wallet-link",
      linkedWallet,
      signature,
      WALLET_LINK_AUTH_MAX_AGE_MS,
    );
    if (!consumed) return null;

    return { agentAddress, linkedWallet };
  } catch {
    return null;
  }
}

export type VerifiedRestoreByLinkedRequest = {
  linkedWallet: `0x${string}`;
};

export async function verifyRestoreByLinkedRequest(
  request: Request,
): Promise<VerifiedRestoreByLinkedRequest | null> {
  const { wallet: linkedWallet, timestamp, signature } = readWalletAuthHeaders(request, "recover");
  if (!linkedWallet || !timestamp || !signature || !isFreshTimestamp(timestamp)) return null;

  const message = restoreByLinkedMessage(timestamp);

  try {
    const valid = await verifyMessage({
      address: linkedWallet,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return null;

    const consumed = await consumeAuthSignature(
      "agent-wallet-restore-linked",
      linkedWallet,
      signature,
      WALLET_LINK_AUTH_MAX_AGE_MS,
    );
    if (!consumed) return null;

    return { linkedWallet };
  } catch {
    return null;
  }
}