/**
 * Apply a single SQL migration file to the linked Supabase project via Management API.
 *
 *   node --experimental-transform-types --no-warnings --env-file=.env.local scripts/apply-sql-migration.mts supabase/migrations/20260704100000_platform_profiles_comments.sql
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationArg = process.argv[2];
if (!migrationArg) {
  console.error("Usage: apply-sql-migration.mts <path-to.sql>");
  process.exit(1);
}

const migrationPath = path.resolve(migrationArg);
if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const tokenPath = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  ".supabase",
  "access-token",
);

if (!fs.existsSync(tokenPath)) {
  console.error(
    "Missing ~/.supabase/access-token — run `npx supabase login` or set SUPABASE_ACCESS_TOKEN",
  );
  process.exit(1);
}

const accessToken = (
  process.env.SUPABASE_ACCESS_TOKEN ?? fs.readFileSync(tokenPath, "utf8")
).trim();

async function main(): Promise<void> {
  const sql = fs.readFileSync(migrationPath, "utf8");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    console.error("Migration failed:", body.message ?? body.error ?? res.statusText);
    process.exit(1);
  }

  console.log(`OK applied ${path.basename(migrationPath)} to project ${projectRef}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}