import { getStoredLinkedMetaMaskAddress } from "@/lib/agent-wallet-local";
import {
  getCachedMyPostsCatalogHeaders,
  cacheMyPostsAuth,
} from "@/lib/my-posts-auth-cache";
import { myPostsHeaders, signMyPostsAuth } from "@/lib/publish-client";
import {
  getConnectedWalletAddress,
  getEthereumProvider,
} from "@/lib/wallet-connection-client";

type ResolveOptions = {
  /** Prompt wallet sign when no cached my-posts auth (needed for publisher auto-access). */
  signIfMissing?: boolean;
};

function resolvePublisherAddress(
  connected: `0x${string}` | null,
): `0x${string}` | null {
  const linked = getStoredLinkedMetaMaskAddress() as `0x${string}` | null;
  return connected ?? linked;
}

/** Auth headers so the catalog API can recognize posts you published. */
export async function resolveCatalogAuthHeaders(
  options: ResolveOptions = {},
): Promise<Record<string, string>> {
  const connected = await getConnectedWalletAddress();
  const publisher = resolvePublisherAddress(connected);
  if (!publisher) return {};

  const cached = getCachedMyPostsCatalogHeaders(publisher);
  if (Object.keys(cached).length > 0) return cached;

  if (!options.signIfMissing || !connected) return {};

  const ethereum = await getEthereumProvider();
  if (!ethereum) return {};

  try {
    const auth = await signMyPostsAuth(ethereum, connected);
    cacheMyPostsAuth(auth);
    return myPostsHeaders(auth);
  } catch {
    return {};
  }
}