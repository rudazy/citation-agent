/**
 * Archive off-brand DB posts so the catalog reads as crypto research only.
 *
 *   node --experimental-transform-types --no-warnings --env-file=.env.local scripts/archive-catalog-noise.mts
 */

import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ARCHIVE_IDS = [
  "england-vs-ghana-f82dd21f",
  "trustgate-6fce0630",
  "e2e-smoke-15-42-39-c7844386",
  "day1-smoke-15-22-38-a224b02d",
];

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("creator_posts")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .in("id", ARCHIVE_IDS)
    .select("id, title");

  if (error) throw new Error(error.message);
  console.log(`Archived ${data?.length ?? 0} posts:`);
  for (const row of data ?? []) {
    console.log(`  ${row.id} — ${row.title}`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}