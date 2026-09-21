import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { getEnv } from "@/server/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, standard for GCM

/** Derives a 32-byte key from the configured ENCRYPTION_KEY, whatever length it happens to be. */
function deriveKey(): Buffer {
  return createHash("sha256").update(getEnv().ENCRYPTION_KEY).digest();
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  keyVersion: number;
}

/**
 * Encrypts a Meta access token for storage in whatsapp_credentials.encrypted_token.
 * The IV and auth tag are packed alongside the ciphertext (iv:tag:ciphertext, each
 * base64) so a single column holds everything needed to decrypt, given the key.
 */
export function encryptToken(plaintext: string): EncryptedPayload {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const packed = Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  return { ciphertext: packed, keyVersion: getEnv().ENCRYPTION_KEY_VERSION };
}

/**
 * Decrypts a token encrypted by encryptToken(). `keyVersion` is checked against
 * the currently configured key version — a mismatch means this token was
 * encrypted under a key that has since been rotated, and needs its own
 * decrypt path (not implemented: no key rotation exists yet to produce one).
 */
export function decryptToken(payload: EncryptedPayload): string {
  if (payload.keyVersion !== getEnv().ENCRYPTION_KEY_VERSION) {
    throw new Error(
      `Token was encrypted with key version ${payload.keyVersion}, but the current key version is ${getEnv().ENCRYPTION_KEY_VERSION}. Key rotation/decryption-under-old-key is not implemented yet.`
    );
  }

  const key = deriveKey();
  const raw = Buffer.from(payload.ciphertext, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
