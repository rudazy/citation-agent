import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const AGENT_SESSION_COOKIE = "agent_session";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Returns existing session id or creates a new httpOnly cookie. */
export async function ensureAgentSession(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(AGENT_SESSION_COOKIE)?.value;
  if (existing && existing.length >= 16) return existing;

  const sessionId = randomUUID();
  cookieStore.set(AGENT_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return sessionId;
}

export async function getAgentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AGENT_SESSION_COOKIE)?.value ?? null;
}