import { fetchWithRetry } from "@/lib/client-fetch";

export type ProfileStatus = {
  hasProfile: boolean;
  username: string | null;
  displayName: string | null;
  canChangeUsername: boolean;
  nextChangeAt: string | null;
  agentConfigured: boolean;
  /** Set-once payout wallet; owner-only (null when viewing someone else). */
  payoutWallet: string | null;
  /** Optional tip wallet override; null = tips settle to the payout wallet. */
  tipWallet: string | null;
};

const EMPTY_PROFILE: ProfileStatus = {
  hasProfile: false,
  username: null,
  displayName: null,
  canChangeUsername: true,
  nextChangeAt: null,
  agentConfigured: false,
  payoutWallet: null,
  tipWallet: null,
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
    payoutWallet: data.payoutWallet ?? null,
    tipWallet: data.tipWallet ?? null,
  };
}

/**
 * Set or clear (pass null) the tip wallet override with my-posts-style
 * signed headers. Cleared tips revert to the payout wallet.
 */
export async function saveTipWallet(
  tipWallet: string | null,
  headers: Record<string, string>,
): Promise<string | null> {
  const res = await fetch("/api/profile/tip-wallet", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ tipWallet }),
  });
  const data = (await res.json()) as { error?: string; tipWallet?: string | null };
  if (!res.ok) {
    throw new Error(data.error ?? `Failed to save tip wallet (${res.status})`);
  }
  return data.tipWallet ?? null;
}

/**
 * Change the profile payout wallet with my-posts-style signed headers.
 * Applies to future publishes and tips only.
 */
export async function savePayoutWallet(
  payoutWallet: string,
  headers: Record<string, string>,
): Promise<string> {
  const res = await fetch("/api/profile/payout-wallet", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ payoutWallet }),
  });
  const data = (await res.json()) as { error?: string; payoutWallet?: string };
  if (!res.ok || !data.payoutWallet) {
    throw new Error(data.error ?? `Failed to save payout wallet (${res.status})`);
  }
  return data.payoutWallet;
}