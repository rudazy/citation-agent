import { getAddress } from "viem";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  canChangeUsername,
  normalizeUsernameInput,
  usernameChangeCooldownEndsAt,
  validateUsername,
} from "@/lib/username";

export type PlatformProfile = {
  id: string;
  username: string;
  usernameChangedAt: string;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  username: string;
  username_changed_at: string;
  created_at: string;
};

type WalletRole = "agent" | "publisher";

function rowToProfile(row: ProfileRow): PlatformProfile {
  return {
    id: row.id,
    username: row.username,
    usernameChangedAt: row.username_changed_at,
    createdAt: row.created_at,
  };
}

function normalizeWallet(value: string): `0x${string}` | null {
  try {
    return getAddress(value.trim());
  } catch {
    return null;
  }
}

async function getProfileIdForWallet(wallet: string): Promise<string | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const normalized = normalizeWallet(wallet);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("profile_wallets")
    .select("profile_id")
    .eq("wallet_address", normalized.toLowerCase())
    .maybeSingle();

  if (error || !data) return null;
  return data.profile_id as string;
}

export async function getProfileById(id: string): Promise<PlatformProfile | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("platform_profiles")
    .select("id, username, username_changed_at, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function getProfileByWallet(
  wallet: string,
): Promise<PlatformProfile | null> {
  const profileId = await getProfileIdForWallet(wallet);
  if (!profileId) return null;
  return getProfileById(profileId);
}

export async function getProfileByUsername(
  username: string,
): Promise<PlatformProfile | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const normalized = normalizeUsernameInput(username);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("platform_profiles")
    .select("id, username, username_changed_at, created_at")
    .eq("username", normalized)
    .maybeSingle();

  if (error || !data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function resolveProfileForWallets(
  wallets: string[],
): Promise<PlatformProfile | null> {
  for (const wallet of wallets) {
    const profile = await getProfileByWallet(wallet);
    if (profile) return profile;
  }
  return null;
}

export type UsernameChangeStatus = {
  canChange: boolean;
  nextChangeAt: string | null;
};

export function getUsernameChangeStatus(profile: PlatformProfile): UsernameChangeStatus {
  const changedAtMs = new Date(profile.usernameChangedAt).getTime();
  const canChange = canChangeUsername(changedAtMs);
  return {
    canChange,
    nextChangeAt: canChange
      ? null
      : new Date(usernameChangeCooldownEndsAt(changedAtMs)).toISOString(),
  };
}

async function isUsernameTaken(username: string, excludeProfileId?: string): Promise<boolean> {
  const existing = await getProfileByUsername(username);
  if (!existing) return false;
  if (excludeProfileId && existing.id === excludeProfileId) return false;
  return true;
}

async function attachWalletToProfile(
  profileId: string,
  wallet: `0x${string}`,
  role: WalletRole,
): Promise<void> {
  const supabase = getAdminClient();
  if (!supabase) return;

  const address = wallet.toLowerCase();
  const existingProfileId = await getProfileIdForWallet(address);
  if (existingProfileId === profileId) return;

  if (existingProfileId && existingProfileId !== profileId) {
    await mergeProfiles(existingProfileId, profileId);
    return;
  }

  await supabase.from("profile_wallets").upsert(
    {
      profile_id: profileId,
      wallet_address: address,
      wallet_role: role,
    },
    { onConflict: "wallet_address" },
  );
}

/** Move all wallets from `fromProfileId` into `intoProfileId`, then delete the empty profile. */
async function mergeProfiles(fromProfileId: string, intoProfileId: string): Promise<void> {
  if (fromProfileId === intoProfileId) return;

  const supabase = getAdminClient();
  if (!supabase) return;

  const { data: wallets, error } = await supabase
    .from("profile_wallets")
    .select("wallet_address, wallet_role")
    .eq("profile_id", fromProfileId);

  if (error || !wallets?.length) {
    await supabase.from("platform_profiles").delete().eq("id", fromProfileId);
    return;
  }

  for (const row of wallets) {
    await supabase.from("profile_wallets").upsert(
      {
        profile_id: intoProfileId,
        wallet_address: row.wallet_address,
        wallet_role: row.wallet_role,
      },
      { onConflict: "wallet_address" },
    );
  }

  await supabase.from("platform_profiles").delete().eq("id", fromProfileId);
}

export async function linkPublisherToAgentProfile(
  agentAddress: `0x${string}`,
  publisherAddress: `0x${string}`,
): Promise<PlatformProfile | null> {
  const agentProfile = await getProfileByWallet(agentAddress);
  const publisherProfile = await getProfileByWallet(publisherAddress);

  if (agentProfile && publisherProfile) {
    if (agentProfile.id !== publisherProfile.id) {
      await mergeProfiles(agentProfile.id, publisherProfile.id);
    }
    await attachWalletToProfile(publisherProfile.id, agentAddress, "agent");
    await attachWalletToProfile(publisherProfile.id, publisherAddress, "publisher");
    return getProfileById(publisherProfile.id);
  }

  if (publisherProfile) {
    await attachWalletToProfile(publisherProfile.id, agentAddress, "agent");
    return publisherProfile;
  }

  if (agentProfile) {
    await attachWalletToProfile(agentProfile.id, publisherAddress, "publisher");
    return agentProfile;
  }

  return null;
}

export type SetUsernameResult =
  | { ok: true; profile: PlatformProfile }
  | { ok: false; error: string; status: number };

export async function setUsername(params: {
  username: string;
  agentAddress: `0x${string}`;
  publisherAddress?: `0x${string}` | null;
}): Promise<SetUsernameResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Profiles are not configured", status: 503 };
  }

  const normalized = normalizeUsernameInput(params.username);
  if (!normalized) {
    return { ok: false, error: "Invalid username format", status: 400 };
  }

  const validationError = validateUsername(normalized);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const existing = await resolveProfileForWallets(
    [
      params.agentAddress,
      ...(params.publisherAddress ? [params.publisherAddress] : []),
    ].map((w) => w.toLowerCase()),
  );

  if (!existing) {
    if (await isUsernameTaken(normalized)) {
      return { ok: false, error: "Username is already taken", status: 409 };
    }

    const { data, error } = await supabase
      .from("platform_profiles")
      .insert({ username: normalized })
      .select("id, username, username_changed_at, created_at")
      .single();

    if (error || !data) {
      console.error("[platform-profile] insert failed:", error?.message);
      return { ok: false, error: "Failed to save username", status: 500 };
    }

    const profile = rowToProfile(data as ProfileRow);
    await attachWalletToProfile(profile.id, params.agentAddress, "agent");
    if (params.publisherAddress) {
      await attachWalletToProfile(profile.id, params.publisherAddress, "publisher");
    }
    return { ok: true, profile };
  }

  if (existing.username === normalized) {
    await attachWalletToProfile(existing.id, params.agentAddress, "agent");
    if (params.publisherAddress) {
      await attachWalletToProfile(existing.id, params.publisherAddress, "publisher");
    }
    return { ok: true, profile: existing };
  }

  const changedAtMs = new Date(existing.usernameChangedAt).getTime();
  if (!canChangeUsername(changedAtMs)) {
    const next = new Date(usernameChangeCooldownEndsAt(changedAtMs)).toISOString();
    return {
      ok: false,
      error: `Username can be changed again after ${next}`,
      status: 429,
    };
  }

  if (await isUsernameTaken(normalized, existing.id)) {
    return { ok: false, error: "Username is already taken", status: 409 };
  }

  const { data, error } = await supabase
    .from("platform_profiles")
    .update({
      username: normalized,
      username_changed_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id, username, username_changed_at, created_at")
    .single();

  if (error || !data) {
    console.error("[platform-profile] update failed:", error?.message);
    return { ok: false, error: "Failed to update username", status: 500 };
  }

  const profile = rowToProfile(data as ProfileRow);
  await attachWalletToProfile(profile.id, params.agentAddress, "agent");
  if (params.publisherAddress) {
    await attachWalletToProfile(profile.id, params.publisherAddress, "publisher");
  }
  return { ok: true, profile };
}

export async function requirePublisherUsername(
  publisherAddress: `0x${string}`,
  agentAddress?: `0x${string}` | null,
): Promise<
  | { ok: true; profile: PlatformProfile }
  | { ok: false; error: string; status: number }
> {
  if (agentAddress) {
    await linkPublisherToAgentProfile(agentAddress, publisherAddress);
  }

  const profile = await resolveProfileForWallets([
    publisherAddress,
    ...(agentAddress ? [agentAddress] : []),
  ]);

  if (!profile) {
    return {
      ok: false,
      error: "Choose a username before publishing",
      status: 403,
    };
  }

  return { ok: true, profile };
}