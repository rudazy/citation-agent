import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAdminClient } from "@/lib/supabase/admin";
import { decryptPrivateKey, encryptPrivateKey } from "@/lib/wallet-crypto";

export type StoredUserAgentWallet = {
  sessionId: string;
  address: `0x${string}`;
  encryptedPrivateKey: string;
  createdAt: string;
};

export async function getUserAgentWallet(
  sessionId: string,
): Promise<StoredUserAgentWallet | null> {
  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_agent_wallets")
    .select("session_id, address, encrypted_private_key, created_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    sessionId: data.session_id,
    address: data.address as `0x${string}`,
    encryptedPrivateKey: data.encrypted_private_key,
    createdAt: data.created_at,
  };
}

export async function getUserAgentPrivateKey(
  sessionId: string,
): Promise<`0x${string}` | null> {
  const wallet = await getUserAgentWallet(sessionId);
  if (!wallet) return null;
  return decryptPrivateKey(wallet.encryptedPrivateKey);
}

export async function provisionUserAgentWallet(
  sessionId: string,
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

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = encryptPrivateKey(privateKey);

  const { error } = await supabase.from("user_agent_wallets").insert({
    session_id: sessionId,
    address: account.address,
    encrypted_private_key: encrypted,
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