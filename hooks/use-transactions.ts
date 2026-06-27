/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from "react";

export type PaymentEvent = {
  id: string;
  created_at: string;
  endpoint: string;
  payer: string;
  amount_usdc: string;
  network: string;
  gateway_tx: string | null;
  payment_memo?: string | null;
  raw: Record<string, unknown> | null;
};

type UsePaymentEventsOptions = {
  /** Only fetch when the viewer is the operator (avoids prompting non-operators). */
  enabled?: boolean;
  /** Returns signed operator headers for the gated /api/dashboard route. */
  getAuthHeaders: () => Promise<Record<string, string>>;
  /** Poll interval; the ledger is no longer realtime (RLS-locked tables). */
  pollMs?: number;
};

/**
 * Settled payment events, read through the operator-gated API route (service-role
 * admin client). The financial tables are not anon-readable, so this polls rather
 * than subscribing to Supabase Realtime.
 */
export function usePaymentEvents({
  enabled = true,
  getAuthHeaders,
  pollMs = 12000,
}: UsePaymentEventsOptions) {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/dashboard/payment-events", {
        cache: "no-store",
        headers,
      });

      if (res.status === 503) {
        // Supabase service role not configured server-side.
        setConfigured(false);
        setEvents([]);
        setError(
          "Supabase is not configured. Payments settle on Arc but are not saved until SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are set.",
        );
        return;
      }

      if (!res.ok) {
        setEvents([]);
        setError(
          res.status === 403
            ? "Operator access required to view the payment ledger."
            : `Failed to load payment events (${res.status}).`,
        );
        return;
      }

      setConfigured(true);
      const data = (await res.json()) as { events?: PaymentEvent[] };
      setEvents(data.events ?? []);
    } catch (err) {
      console.error("Failed to fetch payment events:", err);
      setEvents([]);
      setError(err instanceof Error ? err.message : "Failed to load payment events");
    } finally {
      setLoading(false);
    }
  }, [enabled, getAuthHeaders]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchEvents();
    const id = setInterval(() => void fetchEvents(), pollMs);
    return () => clearInterval(id);
  }, [enabled, fetchEvents, pollMs]);

  return { events, loading, error, configured, refetch: fetchEvents };
}
