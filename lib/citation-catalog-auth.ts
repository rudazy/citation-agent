import { getStoredLinkedMetaMaskAddress } from "@/lib/agent-wallet-local";
import {
  getCachedMyPostsCatalogHeaders,
  cacheMyPostsAuth,
} from "@/lib/my-posts-auth-cache";
import { myPostsHeaders, signMyPostsAuth } from "@/lib/publish-client";
import {
  getAuthorizedAccount,
  getConnectedWalletAddress,
  getEthereumProvider,
} from "@/lib/wallet-connection-client";

type ResolveOptions = {
  /**
   * Prompt wallet sign when no cached my-posts auth.
   * Must only be set from user-initiated actions (unlock, expand) — never catalog load.
   */
  signIfMissing?: boolean;
  /** Sign even without a publish-flow wallet hint (e.g. explicit unlock). */
  forceSign?: boolean;
};

function resolvePublisherAddress(
  connected: `0x${string}` | null,
): `0x${string}` | null {
  const linked = getStoredLinkedMetaMaskAddress() as `0x${string}` | null;
  return connected ?? linked;
}

/**
 * Auth headers so the catalog API can recognize posts you published.
 * forceSign: true (unlock path) always prompts the connected wallet so authors
 * get free access even when linked-wallet localStorage was cleared.
 */
export async function resolveCatalogAuthHeaders(
  options: ResolveOptions = {},
): Promise<Record<string, string>> {
  const connected = await getConnectedWalletAddress();
  const publisher = resolvePublisherAddress(connected);
  if (!publisher) return {};

  const cached = getCachedMyPostsCatalogHeaders(publisher);
  if (Object.keys(cached).length > 0) return cached;

  if (!options.signIfMissing) return {};

  const linkedPublisher = getStoredLinkedMetaMaskAddress() as `0x${string}` | null;
  // forceSign (explicit unlock) always allowed; otherwise only when localStorage
  // already knows this publisher from a prior link/publish flow.
  const hasPublisherHint =
    options.forceSign === true ||
    linkedPublisher?.toLowerCase() === publisher.toLowerCase();
  if (!hasPublisherHint) return {};

  const ethereum = await getEthereumProvider();
  if (!ethereum) return {};

  // Prefer live eth_requestAccounts when force-signing so a locked extension
  // still surfaces the MetaMask popup.
  let account = connected ?? (await getAuthorizedAccount(ethereum));
  if (!account && options.forceSign) {
    try {
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts[0]) account = accounts[0] as `0x${string}`;
    } catch {
      return {};
    }
  }
  if (!account) return {};

  // When force-signing, the active account is the publisher identity for this action.
  const signAs = options.forceSign ? account : publisher;
  if (!options.forceSign && account.toLowerCase() !== publisher.toLowerCase()) {
    return {};
  }

  try {
    const auth = await signMyPostsAuth(ethereum, signAs);
    cacheMyPostsAuth(auth);
    return myPostsHeaders(auth);
  } catch {
    return {};
  }
}