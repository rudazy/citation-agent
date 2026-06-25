import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Legacy static salt. Retained ONLY so wallets encrypted before per-record
// salts were introduced (3-part `iv:tag:data` blobs) remain decryptable.
// New encryptions never use this; they generate a random per-record salt.
const LEGACY_SALT = "citation-agent-wallet-v1";
const ALGO = "aes-256-gcm";
const SALT_BYTES = 16;
const IV_BYTES = 12;

function encryptionSecret(): string {
  // Fail closed: only the dedicated encryption key is accepted. We must never
  // silently fall back to SUPABASE_SERVICE_ROLE_KEY, which would couple wallet
  // secrecy to a key that bypasses row-level security.
  const key = process.env.AGENT_WALLET_ENCRYPTION_KEY;
  if (!key || key.includes("your-")) {
    throw new Error(
      "AGENT_WALLET_ENCRYPTION_KEY required to store agent wallets.",
    );
  }
  return key;
}

function deriveKey(salt: Buffer | string): Buffer {
  return scryptSync(encryptionSecret(), salt, 32);
}

/**
 * Encrypt a hex private key for storage at rest in Supabase.
 *
 * Format: `salt:iv:tag:data` (all base64). A fresh cryptographically random
 * salt and IV are generated per encryption, so encrypting the same key twice
 * yields different ciphertext and each record derives a distinct AES key.
 */
export function encryptPrivateKey(privateKey: string): string {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, deriveKey(salt), iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a stored private key blob. The format is detected by part count:
 *  - 4 parts (`salt:iv:tag:data`) use the per-record random salt.
 *  - 3 parts (`iv:tag:data`) are legacy blobs and use the static LEGACY_SALT.
 */
export function decryptPrivateKey(payload: string): `0x${string}` {
  const parts = payload.split(":");

  let salt: Buffer | string;
  let ivB64: string;
  let tagB64: string;
  let dataB64: string;

  if (parts.length === 4) {
    const [saltB64, iv, tag, data] = parts;
    salt = Buffer.from(saltB64, "base64");
    ivB64 = iv;
    tagB64 = tag;
    dataB64 = data;
  } else if (parts.length === 3) {
    const [iv, tag, data] = parts;
    salt = LEGACY_SALT;
    ivB64 = iv;
    tagB64 = tag;
    dataB64 = data;
  } else {
    throw new Error("Invalid encrypted wallet payload");
  }

  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted wallet payload");
  }

  const decipher = createDecipheriv(ALGO, deriveKey(salt), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const normalized = decrypted.startsWith("0x") ? decrypted : `0x${decrypted}`;
  return normalized as `0x${string}`;
}
