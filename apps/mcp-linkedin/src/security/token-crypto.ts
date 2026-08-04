import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Functionally identical to apps/backend/src/security/token-crypto.ts (see
 * that file for the full rationale on why this is duplicated rather than
 * shared). Unlike apps/mcp-gmail-calendar's copy, this one needs both
 * directions: this server refreshes LinkedIn access tokens itself and writes
 * the new encrypted token back to Postgres (see linkedin/credentials.repository.ts).
 */
const ALGORITHM = "aes-256-gcm";

function getKey(encryptionKeyHex: string): Buffer {
  const key = Buffer.from(encryptionKeyHex, "hex");
  if (key.length !== 32) {
    throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must be a 32-byte value, hex-encoded (64 hex characters)");
  }
  return key;
}

export function encryptSecret(plaintext: string, encryptionKeyHex: string): string {
  const key = getKey(encryptionKeyHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(stored: string, encryptionKeyHex: string): string {
  const key = getKey(encryptionKeyHex);
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted secret - expected 'iv:authTag:ciphertext' hex format");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf-8");
}