import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/config";

function isServiceRolePlaceholder(key: string): boolean {
  return (
    !key ||
    key.includes("your-service-role") ||
    key.includes("your-service") ||
    key === "your-service-role-key"
  );
}

export function isSupabaseAdminConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return isSupabaseConfigured() && !isServiceRolePlaceholder(key);
}

export function getAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;

  return createClient(getSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!);
}