import { ensureAgentSession } from "@/lib/agent-session";
import { provisionAgentWalletForSession } from "@/lib/agent-wallet";
import {
  getUserAgentWallet,
  linkUserAgentWalletToMetaMask,
} from "@/lib/user-agent-wallet";

/**
 * Tie the wallet that signed a publish to this browser session so catalog reads
 * can recognize owned posts without a separate my-posts signature every time.
 */
export async function ensurePublisherLinkedToSession(
  publisherWallet: `0x${string}`,
): Promise<void> {
  const sessionId = await ensureAgentSession();
  const existing = await getUserAgentWallet(sessionId);
  if (!existing) {
    await provisionAgentWalletForSession({ recoveryWallet: publisherWallet });
    return;
  }
  await linkUserAgentWalletToMetaMask(sessionId, publisherWallet);
}