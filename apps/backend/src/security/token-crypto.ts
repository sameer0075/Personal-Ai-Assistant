import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts/decrypts secrets (Google refresh tokens) before they touch Postgres.
 *
 * NOTE ON DUPLICATION: the MCP server package (apps/mcp-gmail-calendar) has an
 * identical copy of this file. That's deliberate, not an oversight - the two
 * processes are meant to be independently deployable (the MCP server could
 * end up running on a different host later), so we've chosen a tiny bit of
 * duplication over a shared internal package for something this small and
 * stable. Both copies MUST use the same GOOGLE_TOKEN_ENCRYPTION_KEY (32-byte,
 * hex-encoded) or one process won't be able to decrypt what the other wrote.
 *
 * Format stored in the DB: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
const ALGORITHM = "aes-256-gcm";

function getKey(encryptionKeyHex: string): Buffer {
  const key = Buffer.from(encryptionKeyHex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be a 32-byte value, hex-encoded (64 hex characters). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

export function encryptSecret(plaintext: string, encryptionKeyHex: string): string {
  const key = getKey(encryptionKeyHex);
  const iv = randomBytes(12); // 96-bit IV is the GCM recommendation
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