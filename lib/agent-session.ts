import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import {
  AGENT_SESSION_MAX_AGE_SECONDS,
  AGENT_SESSION_ROTATION_MS,
} from "@/lib/agent-session-config";
import { getAdminClient } from "@/lib/supabase/admin";
import { migrateUserAgentWalletSession } from "@/lib/user-agent-wallet";

export const AGENT_SESSION_COOKIE = "agent_session";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AGENT_SESSION_MAX_AGE_SECONDS,
  };
}

async function getSessionRotationAge(sessionId: string): Promise<number | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("agent_sessions")
    .select("last_rotated_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!data?.last_rotated_at) return null;
  const rotatedAt = new Date(data.last_rotated_at).getTime();
  return Number.isFinite(rotatedAt) ? rotatedAt : null;
}

async function markSessionRotated(sessionId: string): Promise<void> {
  const supabase = getAdminClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  await supabase.from("agent_sessions").upsert(
    {
      session_id: sessionId,
      created_at: now,
      last_rotated_at: now,
    },
    { onConflict: "session_id" },
  );
}

/** Issue a fresh session id, migrate any bound wallet, and set the cookie. */
export async function rotateAgentSession(previousSessionId?: string | null): Promise<string> {
  const cookieStore = await cookies();
  const oldSessionId = previousSessionId ?? cookieStore.get(AGENT_SESSION_COOKIE)?.value ?? null;
  const newSessionId = randomUUID();

  if (oldSessionId && oldSessionId.length >= 16) {
    await migrateUserAgentWalletSession(oldSessionId, newSessionId);
    const supabase = getAdminClient();
    if (supabase) {
      await supabase.from("agent_sessions").delete().eq("session_id", oldSessionId);
    }
  }

  await markSessionRotated(newSessionId);
  cookieStore.set(AGENT_SESSION_COOKIE, newSessionId, cookieOptions());
  return newSessionId;
}

/** Returns existing session id or creates a new httpOnly cookie (with rotation). */
export async function ensureAgentSession(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(AGENT_SESSION_COOKIE)?.value;

  if (existing && existing.length >= 16) {
    const rotatedAt = await getSessionRotationAge(existing);
    if (
      rotatedAt !== null &&
      Date.now() - rotatedAt >= AGENT_SESSION_ROTATION_MS
    ) {
      return rotateAgentSession(existing);
    }

    if (rotatedAt === null) {
      await markSessionRotated(existing);
    }

    return existing;
  }

  const sessionId = randomUUID();
  await markSessionRotated(sessionId);
  cookieStore.set(AGENT_SESSION_COOKIE, sessionId, cookieOptions());
  return sessionId;
}

export async function getAgentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AGENT_SESSION_COOKIE)?.value ?? null;
}