import { getAddress } from "viem";
import type { CreatorContent } from "@/lib/citations";

function normalizeViewerWallet(address: string): string | null {
  try {
    return getAddress(address).toLowerCase();
  } catch {
    return null;
  }
}

/** Post ids the viewer published (database posts only; signing wallet must match). */
export function getCreatorOwnedPostIds(
  viewerWallets: Set<string>,
  items: CreatorContent[],
): Set<string> {
  if (viewerWallets.size === 0) return new Set();

  const owned = new Set<string>();
  for (const item of items) {
    if (item.source !== "database") continue;
    const publisher = normalizeViewerWallet(item.connectedWallet);
    if (publisher && viewerWallets.has(publisher)) {
      owned.add(item.id);
    }
  }
  return owned;
}

export function isCreatorOwnedPost(
  content: CreatorContent,
  viewerWallets: Set<string>,
): boolean {
  if (content.source !== "database" || viewerWallets.size === 0) return false;
  const publisher = normalizeViewerWallet(content.connectedWallet);
  return publisher !== null && viewerWallets.has(publisher);
}