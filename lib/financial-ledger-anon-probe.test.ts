import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const TABLES = [
  { name: "payment_events", column: "id" },
  { name: "creator_earnings", column: "id" },
  { name: "agent_reputation", column: "payer" },
] as const;

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return (
    value.includes("your-anon-key") ||
    value.includes("your-project") ||
    value.includes("your-supabase")
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const probeEnabled = !isPlaceholder(url) && !isPlaceholder(anonKey);

describe.skipIf(!probeEnabled)("financial ledger anon RLS probe (read-only)", () => {
  for (const table of TABLES) {
    it(`${table.name}: anon SELECT is blocked`, async () => {
      const client = createClient(url!, anonKey!);
      const { data, error } = await client.from(table.name).select(table.column).limit(1);

      if (error) {
        expect(error.message.toLowerCase()).toMatch(
          /permission|denied|not authorized|42501|policy|row-level security/,
        );
        return;
      }

      // Some revoked-grant setups return empty data without a descriptive error.
      expect(data ?? []).toHaveLength(0);
    });
  }
});