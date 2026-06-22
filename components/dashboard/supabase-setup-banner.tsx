"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { Button } from "@/components/ui/button";

type HealthResponse = {
  supabase?: {
    client: boolean;
    server: boolean;
    ready: boolean;
  };
};

export function SupabaseSetupBanner({
  clientError,
  onRefresh,
  refreshing,
}: {
  clientError?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/health")
      .then((res) => res.json())
      .then((data: HealthResponse) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = health?.supabase?.ready ?? false;
  if (ready && !clientError) return null;

  const missingClient = health?.supabase?.client === false;
  const missingServer = health?.supabase?.server === false;

  return (
    <Panel className="border-[#f5c842]/30 bg-[#f5c842]/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-[#f5c842] shrink-0 mt-0.5" />
        <div className="space-y-2 min-w-0">
          <p className="font-semibold tracking-wide text-[#f5c842]">
            Payment history unavailable
          </p>
          <p className="text-sm text-muted-foreground font-mono leading-relaxed">
            {clientError ??
              "Payments you make today settle on Arc, but this dashboard reads from Supabase. Configure the database to see amounts, dates, and live updates."}
          </p>
          <ul className="text-xs font-mono text-muted-foreground space-y-1 list-disc pl-4">
            {missingClient && (
              <li>
                Client: set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in .env.local and Vercel.
              </li>
            )}
            {missingServer && (
              <li>
                Server: set <code>SUPABASE_SERVICE_ROLE_KEY</code> so new payments are
                recorded after settlement.
              </li>
            )}
            {!health && (
              <li>
                Run Supabase migrations in <code>supabase/migrations/</code>, then add
                all three env vars locally and on Vercel.
              </li>
            )}
          </ul>
        </div>
      </div>
      {onRefresh && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh payments
        </Button>
      )}
    </Panel>
  );
}