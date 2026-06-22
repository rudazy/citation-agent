import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT = "citation-agent-wallet-v1";
const ALGO = "aes-256-gcm";

function encryptionSecret(): string {
  const key =
    process.env.AGENT_WALLET_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.includes("your-")) {
    throw new Error(
      "AGENT_WALLET_ENCRYPTION_KEY (or SUPABASE_SERVICE_ROLE_KEY) required to store agent wallets.",
    );
  }
  return key;
}

function deriveKey(): Buffer {
  return scryptSync(encryptionSecret(), SALT, 32);
}

/** Encrypt a hex private key for storage at rest in Supabase. */
export function encryptPrivateKey(privateKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypt a stored private key blob. */
export function decryptPrivateKey(payload: string): `0x${string}` {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted wallet payload");
  }
  const decipher = createDecipheriv(
    ALGO,
    deriveKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const normalized = decrypted.startsWith("0x") ? decrypted : `0x${decrypted}`;
  return normalized as `0x${string}`;
}