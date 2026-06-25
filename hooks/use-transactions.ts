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
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type PaymentEvent = {
  id: string;
  created_at: string;
  endpoint: string;
  payer: string;
  amount_usdc: string;
  network: string;
  gateway_tx: string | null;
  payment_memo?: string | null;
};

type UsePaymentEventsOptions = {
  /** Only the operator may fetch payment data; disabled otherwise. */
  enabled?: boolean;
  getAuthHeaders?: () => Promise<Record<string, string>>;
};

/**
 * Operator-only payment ledger. Fetched from the operator-authenticated server
 * route (not read directly from Supabase), so non-operators cannot retrieve data.
 */
export function usePaymentEvents({
  enabled = false,
  getAuthHeaders,
}: UsePaymentEventsOptions = {}) {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(isSupabaseConfigured());

  const fetchEvents = useCallback(async () => {
    if (!enabled || !getAuthHeaders) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/dashboard/payment-events", {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load payments (${res.status})`);
      }
      const data = (await res.json()) as { events?: PaymentEvent[] };
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, getAuthHeaders]);

  useEffect(() => {
    if (enabled) {
      void fetchEvents();
    } else {
      setEvents([]);
      setError(null);
      setLoading(false);
    }
  }, [enabled, fetchEvents]);

  return { events, loading, error, configured, refetch: fetchEvents };
}