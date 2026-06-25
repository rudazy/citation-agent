import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { encryptPrivateKey, decryptPrivateKey } from "./wallet-crypto";



const TEST_SECRET = "test-encryption-secret-at-least-32-chars-long";
const LEGACY_SALT = "citation-agent-wallet-v1";
const SAMPLE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603a7ebfcecf";

// Reproduces the old static-salt scheme that produced 3-part `iv:tag:data`
// blobs, so we can prove existing wallets still decrypt after the change.
function encryptLegacy(privateKey: string): string {
  const key = scryptSync(TEST_SECRET, LEGACY_SALT, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

describe("wallet-crypto", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    process.env.AGENT_WALLET_ENCRYPTION_KEY = TEST_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = original;
  });

  it("round-trips encrypt then decrypt", () => {
    const blob = encryptPrivateKey(SAMPLE_KEY);
    expect(decryptPrivateKey(blob)).toBe(SAMPLE_KEY);
  });

  it("uses a 4-part self-describing format with a per-record salt", () => {
    const blob = encryptPrivateKey(SAMPLE_KEY);
    expect(blob.split(":")).toHaveLength(4);
  });

  it("produces different ciphertext for the same key (salt is not static)", () => {
    const a = encryptPrivateKey(SAMPLE_KEY);
    const b = encryptPrivateKey(SAMPLE_KEY);
    // Salt (first segment) and overall blob must differ.
    expect(a).not.toBe(b);
    expect(a.split(":")[0]).not.toBe(b.split(":")[0]);
    // Both still decrypt to the same plaintext.
    expect(decryptPrivateKey(a)).toBe(SAMPLE_KEY);
    expect(decryptPrivateKey(b)).toBe(SAMPLE_KEY);
  });

  it("still decrypts legacy 3-part static-salt blobs (backward compatible)", () => {
    const legacy = encryptLegacy(SAMPLE_KEY);
    expect(legacy.split(":")).toHaveLength(3);
    expect(decryptPrivateKey(legacy)).toBe(SAMPLE_KEY);
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptPrivateKey("only-one-part")).toThrow();
    expect(() => decryptPrivateKey("a:b")).toThrow();
  });

  it("fails closed when the encryption key is missing (no service-role fallback)", () => {
    delete process.env.AGENT_WALLET_ENCRYPTION_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-must-not-be-used-as-fallback";
    expect(() => encryptPrivateKey(SAMPLE_KEY)).toThrow(
      /AGENT_WALLET_ENCRYPTION_KEY required/,
    );
  });
});
