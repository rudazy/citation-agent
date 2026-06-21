/**
 * Resolves Supabase public credentials from env.
 * Accepts both key names so Vercel/dashboard setups using ANON_KEY still work.
 */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

function isPlaceholder(value: string): boolean {
  return (
    !value ||
    value.includes("your-project-url") ||
    value.includes("your-publishable") ||
    value.includes("your-anon-key")
  );
}

/** True when real Supabase public credentials are present in env. */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  return !isPlaceholder(url) && !isPlaceholder(anonKey);
}

export function assertSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}