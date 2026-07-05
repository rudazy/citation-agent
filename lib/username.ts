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