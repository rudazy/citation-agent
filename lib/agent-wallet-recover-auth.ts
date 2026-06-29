import { getAddress, verifyMessage } from "viem";
import { consumeAuthSignature } from "@/lib/signature-replay-store";
import { normalizeWalletAddress } from "@/lib/publish-auth";

export const RECOVER_MESSAGE_PREFIX = "Citation Agent recover agent wallet";

/** Signed recovery messages older than this are rejected. */
export const RECOVER_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

export function recoverMessage(agentAddress: string, timestamp: string): string {
  return `${RECOVER_MESSAGE_PREFIX} ${getAddress(agentAddress)} ${timestamp}`;
}

export type VerifiedRecoverRequest = {
  agentAddress: `0x${string}`;
  linkedWallet: `0x${string}`;
  signedAtMs: number;
};

export async function verifyRecoverRequest(
  request: Request,
  expectedAgentAddress: `0x${string}`,
): Promise<VerifiedRecoverRequest | null> {
  const linkedWallet = normalizeWalletAddress(
    request.headers.get("x-recover-wallet") ?? "",
  );
  const timestamp = request.headers.get("x-recover-timestamp");
  const signature = request.headers.get("x-recover-signature");

  if (!linkedWallet || !timestamp || !signature) return null;
  if (!/^\d+$/.test(timestamp)) return null;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > RECOVER_AUTH_MAX_AGE_MS) {
    return null;
  }

  let agentAddress: `0x${string}`;
  try {
    agentAddress = getAddress(expectedAgentAddress);
  } catch {
    return null;
  }

  const message = recoverMessage(agentAddress, timestamp);

  try {
    const valid = await verifyMessage({
      address: linkedWallet,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return null;

    const consumed = await consumeAuthSignature(
      "agent-wallet-recover",
      linkedWallet,
      signature,
      RECOVER_AUTH_MAX_AGE_MS,
    );
    if (!consumed) return null;

    return { agentAddress, linkedWallet, signedAtMs: ts };
  } catch {
    return null;
  }
}