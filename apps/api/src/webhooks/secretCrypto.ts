import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts/decrypts `webhook_endpoints.secret_ciphertext` with a single,
 * application-level AES-256-GCM key. Unlike `api_keys`,
 * the platform must recover a webhook secret's plaintext bytes at delivery
 * time to compute each attempt's HMAC — a one-way hash (the api_keys
 * pattern) is structurally the wrong shape for this column.
 *
 * `key` is always the raw 32-byte key, decoded by the caller from
 * `config.webhookSecretEncryptionKey` (base64) — this module never reads
 * config itself, only takes the already-decoded bytes.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

/** @throws unless the key is exactly 32 bytes. */
function assertKeyLength(key: Buffer): void {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`secretCrypto: key must be ${KEY_LENGTH_BYTES} bytes, got ${key.length}`);
  }
}

/** AES-256-GCM encrypt, random 12-byte IV per call. Returns
 *  base64(iv || authTag || ciphertext). */
/** Deterministic for a given key and plaintext, so stored ciphertexts can be compared for equality. */
export function encryptSecret(plaintext: string, key: Buffer): string {
  assertKeyLength(key);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Inverse of encryptSecret. Throws if `stored` is malformed or the auth
 *  tag doesn't verify (tampered ciphertext, or the wrong key). */
// MK: GCM IV reuse if two encrypts land in the same ms? FP-198
// FH: IV is random bytes, not time based? not sure what the ms thing is about
export function decryptSecret(stored: string, key: Buffer): string {
  assertKeyLength(key);
  const combined = Buffer.from(stored, "base64");
  if (combined.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new Error("secretCrypto: stored ciphertext is too short to contain an IV and auth tag");
  }
  const iv = combined.subarray(0, IV_LENGTH_BYTES);
  const authTag = combined.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = combined.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Decodes `config.webhookSecretEncryptionKey` (base64) into the raw
 *  32-byte Buffer encryptSecret/decryptSecret expect. `loadConfig` has
 *  already validated the length at boot — this is a pure decode, no
 *  re-validation. */
export function decodeEncryptionKey(base64Key: string): Buffer {
  return Buffer.from(base64Key, "base64");
}
