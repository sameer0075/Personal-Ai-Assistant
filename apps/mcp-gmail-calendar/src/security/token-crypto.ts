import { createDecipheriv } from "node:crypto";

/**
 * Identical to apps/backend/src/security/token-crypto.ts. This server only
 * ever needs to decrypt (it never writes credentials - the backend's OAuth
 * callback does that), so only that half is implemented here. See the
 * backend copy for the full rationale on why this is duplicated rather than
 * shared: these two processes are meant to be independently deployable.
 */
export function decryptSecret(stored: string, encryptionKeyHex: string): string {
  const key = Buffer.from(encryptionKeyHex, "hex");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a 32-byte value, hex-encoded (64 hex characters)");
  }

  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted secret - expected 'iv:authTag:ciphertext' hex format");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf-8");
}