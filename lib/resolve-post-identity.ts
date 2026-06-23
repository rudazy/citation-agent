/**
 * Server-only: resolve a post's identity wallet from its id.
 */

import { getCreatorContentById } from "@/lib/citations";

export async function resolveIdentityWalletForPost(
  postId: string,
): Promise<`0x${string}` | null> {
  const id = postId.trim();
  if (!id) return null;
  const content = await getCreatorContentById(id);
  if (!content) return null;
  return content.connectedWallet;
}