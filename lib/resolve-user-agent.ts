import { ensureAgentSession } from "@/lib/agent-session";
import { getUserAgentPrivateKey, getUserAgentWallet } from "@/lib/user-agent-wallet";
import { privateKeyToAccount } from "viem/accounts";

export type ResolvedUserAgent = {
  sessionId: string;
  address: `0x${string}`;
  privateKey: `0x${string}`;
};

/** Resolves the browser-bound agent wallet for the current request. */
export async function resolveUserAgent(): Promise<ResolvedUserAgent | null> {
  const sessionId = await ensureAgentSession();
  const privateKey = await getUserAgentPrivateKey(sessionId);
  if (!privateKey) return null;
  return {
    sessionId,
    privateKey,
    address: privateKeyToAccount(privateKey).address,
  };
}

export async function requireUserAgent(): Promise<ResolvedUserAgent> {
  const agent = await resolveUserAgent();
  if (!agent) {
    throw new Error(
      "No agent wallet for this browser. Create one in Marketplace or Attest — each user gets a separate wallet.",
    );
  }
  return agent;
}

export async function hasUserAgentWallet(): Promise<boolean> {
  const sessionId = await ensureAgentSession();
  const wallet = await getUserAgentWallet(sessionId);
  return wallet !== null;
}