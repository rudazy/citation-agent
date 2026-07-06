import { getAdminClient } from "@/lib/supabase/admin";

/** Citation ids this payer has already unlocked (recorded in creator_earnings). */
export async function getPriorUnlockIds(
  payer: string,
  citationIds: string[],
): Promise<Set<string>> {
  if (!payer || citationIds.length === 0) return new Set();

  const supabase = getAdminClient();
  if (!supabase) return new Set();

  const normalizedPayer = payer.toLowerCase();
  const { data, error } = await supabase
    .from("creator_earnings")
    .select("citation_id, payer")
    .in("citation_id", citationIds);

  if (error || !data) return new Set();

  return new Set(
    data
      .filter((row) => row.payer?.toLowerCase() === normalizedPayer)
      .map((row) => row.citation_id),
  );
}

/** Union of citation ids unlocked by any of the given payer wallets. */
export async function getPriorUnlockIdsForWallets(
  payers: Iterable<string>,
  citationIds: string[],
): Promise<Set<string>> {
  const unlocked = new Set<string>();
  for (const payer of payers) {
    const ids = await getPriorUnlockIds(payer, citationIds);
    for (const id of ids) unlocked.add(id);
  }
  return unlocked;
}