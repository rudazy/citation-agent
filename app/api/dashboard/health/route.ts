import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  const clientConfigured = isSupabaseConfigured();
  const serverConfigured = getAdminClient() !== null;

  return NextResponse.json({
    supabase: {
      client: clientConfigured,
      server: serverConfigured,
      ready: clientConfigured && serverConfigured,
    },
  });
}