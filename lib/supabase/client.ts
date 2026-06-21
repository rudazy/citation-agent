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

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "./config";

let warnedMissingConfig = false;

/**
 * Browser Supabase client. Returns null when public env vars are unset so local
 * dev (e.g. attestation-only testing) does not crash the app shell.
 */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "development" && !warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[citation-agent] Supabase not configured — dashboard realtime data disabled. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
      );
    }
    return null;
  }

  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
