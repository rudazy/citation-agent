import { fetchWithRetry } from "@/lib/client-fetch";

export type ProfileStatus = {
  hasProfile: boolean;
  username: string | null;
  displayName: string | null;
  canChangeUsername: boolean;
  nextChangeAt: string | null;
  agentConfigured: boolean;
};

const EMPTY_PROFILE: ProfileStatus = {
  hasProfile: false,
  username: null,
  displayName: null,
  canChangeUsername: true,
  nextChangeAt: null,
  agentConfigured: false,
};

export async function fetchProfile(publisherAddress?: string): Promise<ProfileStatus> {
  const query = publisherAddress
    ? `?publisher=${encodeURIComponent(publisherAddress)}`
    : "";
  try {
    const res = await fetchWithRetry(`/api/profile${query}`);
    if (!res.ok) {
      throw new Error(`Failed to load profile (${res.status})`);
    }
    return (await res.json()) as ProfileStatus;
  } catch {
    return EMPTY_PROFILE;
  }
}

export async function saveUsername(
  username: string,
  publisherAddress?: string,
): Promise<ProfileStatus> {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      ...(publisherAddress ? { publisherAddress } : {}),
    }),
  });
  const data = (await res.json()) as ProfileStatus & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Failed to save username (${res.status})`);
  }
  return {
    hasProfile: true,
    username: data.username ?? null,
    displayName: data.displayName ?? null,
    canChangeUsername: data.canChangeUsername ?? false,
    nextChangeAt: data.nextChangeAt ?? null,
    agentConfigured: true,
  };
}