import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAdminClient } from "@/lib/supabase/admin";
import { decryptPrivateKey, encryptPrivateKey } from "@/lib/wallet-crypto";

export type StoredUserAgentWallet = {
  sessionId: string;
  address: `0x${string}`;
  encryptedPrivateKey: string;
  createdAt: string;
  linkedWallet: `0x${string}` | null;
  /** True when linked via MetaMask signature; false when pasted only. */
  linkedWalletVerified: boolean;
};

type WalletRow = {
  session_id: string;
  address: string;
  encrypted_private_key: string;
  created_at: string;
  linked_wallet?: string | null;
  linked_wallet_verified?: boolean | null;
};

const WALLET_SELECT =
  "session_id, address, encrypted_private_key, created_at, linked_wallet, linked_wallet_verified";

function rowToStoredWallet(row: WalletRow): StoredUserAgentWallet {
  let linkedWallet: `0x${string}` | null = null;
  if (row.linked_wallet) {
    try {
      linkedWallet = getAddress(row.linked_wallet);
    } catch {
      linkedWallet = null;
    }
  }

  return {
    sessionId: row.session_id,
    address: row.address as `0x${string}`,
    encryptedPrivateKey: row.encrypted_private_key,
    createdAt: row.created_at,
    linkedWallet,
    linkedWalletVerified: row.linked_wallet_verified === true,
  };
}

export async function getUserAgentWallet(
  sessionId: string,
): Promise<StoredUserAgentWallet | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_agent_wallets")
    .select(WALLET_SELECT)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !data) return null;

  return rowToStoredWallet(data as WalletRow);
}

export async function getUserAgentWalletByLinkedWallet(
  linkedWallet: `0x${string}`,
): Promise<StoredUserAgentWallet | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  let normalized: string;
  try {
    normalized = getAddress(linkedWallet);
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("user_agent_wallets")
    .select(WALLET_SELECT)
    .ilike("linked_wallet", normalized)
    .maybeSingle();

  if (error || !data) return null;
  return rowToStoredWallet(data as WalletRow);
}

export async function getUserAgentWalletByAddress(
  address: `0x${string}`,
): Promise<StoredUserAgentWallet | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  let normalized: string;
  try {
    normalized = getAddress(address);
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("user_agent_wallets")
    .select(WALLET_SELECT)
    .ilike("address", normalized)
    .maybeSingle();

  if (error || !data) return null;
  return rowToStoredWallet(data as WalletRow);
}

export async function getUserAgentPrivateKey(
  sessionId: string,
): Promise<`0x${string}` | null> {
  const wallet = await getUserAgentWallet(sessionId);
  if (!wallet) return null;
  try {
    return decryptPrivateKey(wallet.encryptedPrivateKey);
  } catch {
    return null;
  }
}

export async function provisionUserAgentWallet(
  sessionId: string,
  options?: { recoveryWallet?: `0x${string}` | null },
): Promise<{ address: `0x${string}`; created: boolean }> {
  const existing = await getUserAgentWallet(sessionId);
  if (existing) {
    return { address: existing.address, created: false };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const recoveryWallet = options?.recoveryWallet ?? null;
  if (recoveryWallet) {
    const taken = await getUserAgentWalletByLinkedWallet(recoveryWallet);
    if (taken) {
      throw new Error("This recovery address is already linked to another agent wallet.");
    }
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = encryptPrivateKey(privateKey);

  const { error } = await supabase.from("user_agent_wallets").insert({
    session_id: sessionId,
    address: account.address,
    encrypted_private_key: encrypted,
    ...(recoveryWallet
      ? { linked_wallet: recoveryWallet, linked_wallet_verified: false }
      : {}),
  });

  if (error) {
    if (error.code === "23505") {
      const raced = await getUserAgentWallet(sessionId);
      if (raced) return { address: raced.address, created: false };
    }
    throw new Error(error.message);
  }

  return { address: account.address, created: true };
}

/** Move the encrypted wallet from an old browser session to a rotated session id. */
export async function migrateUserAgentWalletSession(
  oldSessionId: string,
  newSessionId: string,
): Promise<void> {
  if (!oldSessionId || !newSessionId || oldSessionId === newSessionId) return;

  const supabase = getAdminClient();
  if (!supabase) return;

  const { data: wallet } = await supabase
    .from("user_agent_wallets")
    .select("session_id")
    .eq("session_id", oldSessionId)
    .maybeSingle();

  if (!wallet) return;

  const { error } = await supabase
    .from("user_agent_wallets")
    .update({ session_id: newSessionId })
    .eq("session_id", oldSessionId);

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

/** Re-attach a stored agent wallet to the current browser session after cookie loss. */
export async function rebindUserAgentWalletToSession(
  agentAddress: `0x${string}`,
  sessionId: string,
  linkedWallet: `0x${string}`,
): Promise<StoredUserAgentWallet | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const wallet = await getUserAgentWalletByAddress(agentAddress);
  if (!wallet) return null;

  if (wallet.linkedWallet && wallet.linkedWallet.toLowerCase() !== linkedWallet.toLowerCase()) {
    throw new Error("This agent wallet is linked to a different MetaMask address.");
  }

  const updates: {
    session_id: string;
    linked_wallet?: string;
    linked_wallet_verified?: boolean;
  } = { session_id: sessionId };
  if (!wallet.linkedWallet) {
    updates.linked_wallet = linkedWallet;
    updates.linked_wallet_verified = true;
  }

  const { error } = await supabase
    .from("user_agent_wallets")
    .update(updates)
    .ilike("address", getAddress(agentAddress));

  if (error) {
    if (error.code === "23505") {
      const existing = await getUserAgentWallet(sessionId);
      if (existing && existing.address.toLowerCase() === wallet.address.toLowerCase()) {
        return existing;
      }
      throw new Error("This browser session already has a different agent wallet.");
    }
    throw new Error(error.message);
  }

  return getUserAgentWallet(sessionId);
}

async function assignLinkedWallet(
  sessionId: string,
  linkedWallet: `0x${string}`,
  verified: boolean,
): Promise<StoredUserAgentWallet | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const wallet = await getUserAgentWallet(sessionId);
  if (!wallet) return null;

  const normalizedLinked = getAddress(linkedWallet);

  if (wallet.linkedWallet) {
    if (wallet.linkedWallet.toLowerCase() === normalizedLinked.toLowerCase()) {
      if (verified && !wallet.linkedWalletVerified) {
        const { error: upgradeError } = await supabase
          .from("user_agent_wallets")
          .update({ linked_wallet_verified: true })
          .eq("session_id", sessionId);
        if (upgradeError) throw new Error(upgradeError.message);
        return getUserAgentWallet(sessionId);
      }
      return wallet;
    }
    throw new Error("This agent wallet is already linked to a different recovery address.");
  }

  const taken = await getUserAgentWalletByLinkedWallet(normalizedLinked);
  if (taken && taken.address.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("This recovery address is already linked to another agent wallet.");
  }

  const { error } = await supabase
    .from("user_agent_wallets")
    .update({
      linked_wallet: normalizedLinked,
      linked_wallet_verified: verified,
    })
    .eq("session_id", sessionId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("This recovery address is already linked to another agent wallet.");
    }
    throw new Error(error.message);
  }

  return getUserAgentWallet(sessionId);
}

/** Paste a recovery MetaMask address (no signature — user assumes typo/squat risk). */
export async function pasteRecoveryWalletForSession(
  sessionId: string,
  linkedWallet: `0x${string}`,
): Promise<StoredUserAgentWallet | null> {
  return assignLinkedWallet(sessionId, linkedWallet, false);
}

/** Link via MetaMask signature (marks recovery address as verified). */
export async function linkUserAgentWalletToMetaMask(
  sessionId: string,
  linkedWallet: `0x${string}`,
): Promise<StoredUserAgentWallet | null> {
  return assignLinkedWallet(sessionId, linkedWallet, true);
}

/** Restore an agent wallet on a new device by linked MetaMask address. */
export async function rebindUserAgentWalletByLinkedWallet(
  linkedWallet: `0x${string}`,
  sessionId: string,
): Promise<StoredUserAgentWallet | null> {
  const wallet = await getUserAgentWalletByLinkedWallet(linkedWallet);
  if (!wallet) return null;

  const existing = await getUserAgentWallet(sessionId);
  if (
    existing &&
    existing.address.toLowerCase() !== wallet.address.toLowerCase()
  ) {
    throw new Error("This browser session already has a different agent wallet.");
  }

  if (existing?.address.toLowerCase() === wallet.address.toLowerCase()) {
    return existing;
  }

  const supabase = getAdminClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from("user_agent_wallets")
    .update({ session_id: sessionId })
    .ilike("address", wallet.address);

  if (error) {
    if (error.code === "23505") {
      const rebound = await getUserAgentWallet(sessionId);
      if (rebound?.address.toLowerCase() === wallet.address.toLowerCase()) {
        return rebound;
      }
      throw new Error("This browser session already has a different agent wallet.");
    }
    throw new Error(error.message);
  }

  return getUserAgentWallet(sessionId);
}