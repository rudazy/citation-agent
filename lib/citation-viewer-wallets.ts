import { getAddress } from "viem";
import { ensureAgentSession } from "@/lib/agent-session";
import { verifyMyPostsRequestReadOnly } from "@/lib/publisher-auth";
import { resolveUserAgent } from "@/lib/resolve-user-agent";
import { getUserAgentWallet } from "@/lib/user-agent-wallet";

function addWallet(wallets: Set<string>, address: string | null | undefined): void {
  if (!address?.trim()) return;
  try {
    wallets.add(getAddress(address).toLowerCase());
  } catch {
    // ignore malformed addresses
  }
}

/**
 * Wallets the current browser session may act as when deciding citation access.
 * Includes the session agent, its linked MetaMask recovery address, and an
 * optional read-only my-posts signature on the request.
 */
export async function resolveCitationViewerWallets(request: Request): Promise<Set<string>> {
  const wallets = new Set<string>();

  const agent = await resolveUserAgent();
  if (agent) {
    addWallet(wallets, agent.address);
  }

  const sessionId = await ensureAgentSession();
  const stored = await getUserAgentWallet(sessionId);
  if (stored?.linkedWallet) {
    addWallet(wallets, stored.linkedWallet);
  }

  const provenPublisher = await verifyMyPostsRequestReadOnly(request);
  if (provenPublisher) {
    addWallet(wallets, provenPublisher);
  }

  return wallets;
}