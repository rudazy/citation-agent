export const USERNAME_MIN_LEN = 3;
export const USERNAME_MAX_LEN = 24;
export const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Normalize user input to a canonical lowercase username, or null if invalid shape. */
export function normalizeUsernameInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length < USERNAME_MIN_LEN || trimmed.length > USERNAME_MAX_LEN) {
    return null;
  }
  if (!USERNAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** Returns a user-facing validation error, or null when valid. */
export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN_LEN) {
    return `Username must be at least ${USERNAME_MIN_LEN} characters`;
  }
  if (username.length > USERNAME_MAX_LEN) {
    return `Username must be at most ${USERNAME_MAX_LEN} characters`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Username may only use lowercase letters, numbers, and underscores";
  }
  return null;
}

export function formatUsernameDisplay(username: string): string {
  return `@${username}`;
}

export function usernameChangeCooldownEndsAt(changedAtMs: number): number {
  return changedAtMs + USERNAME_CHANGE_COOLDOWN_MS;
}

export function canChangeUsername(changedAtMs: number, now = Date.now()): boolean {
  return now >= usernameChangeCooldownEndsAt(changedAtMs);
}

/**
 * User-facing cooldown line for the profile settings, or null when a change
 * is allowed right now. Display only; the server stays the source of truth.
 */
export function usernameCooldownMessage(
  nextChangeAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!nextChangeAt) return null;
  const nextMs = new Date(nextChangeAt).getTime();
  if (!Number.isFinite(nextMs) || nextMs <= now) return null;

  const remainingMs = nextMs - now;
  const dayMs = 24 * 60 * 60 * 1000;
  if (remainingMs >= dayMs) {
    const days = Math.ceil(remainingMs / dayMs);
    return `You can change your username again in ${days} day${days === 1 ? "" : "s"}`;
  }
  const hours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  return `You can change your username again in ${hours} hour${hours === 1 ? "" : "s"}`;
}