/**
 * Browser-session persistence for unlocked research bodies (survives page refresh).
 */

const STORAGE_KEY = "citation-agent:unlocked";

export type StoredUnlock = {
  body: string;
  unlockedAt: number;
};

function readAll(): Record<string, StoredUnlock> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredUnlock>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, StoredUnlock>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota or private mode — unlock still works for this page load.
  }
}

export function getStoredUnlock(listingId: string): StoredUnlock | null {
  const row = readAll()[listingId];
  return row?.body ? row : null;
}

export function storeUnlock(listingId: string, body: string): void {
  const all = readAll();
  all[listingId] = { body, unlockedAt: Date.now() };
  writeAll(all);
}

export function loadStoredUnlocks(): Record<string, StoredUnlock> {
  return readAll();
}