import argon2 from "argon2";
import type { Config } from "../config.js";

/**
 * Password hashing. Uses argon2id at OWASP-documented minimum parameters
 * (19 MiB / t=2 / p=1 by default), a deliberate fit for the 512 MB
 * container budget — cheap enough not to risk memory pressure under
 * concurrent logins, while still being a real adaptive hash (never plain
 * sha256/md5 and never a fixed low iteration count).
 */
/** argon2id with the cost parameters from config (about 19 MiB, t=2, p=1). */
export async function hashPassword(plain: string, config: Config): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: config.argon2MemoryKib,
    timeCost: config.argon2TimeCost,
    parallelism: config.argon2Parallelism,
  });
}

/**
 * Verifies a plaintext password against an argon2-encoded hash. Returns
 * `false` (rather than throwing) on a malformed/foreign hash, so a caller
 * never has to special-case verification failures vs. malformed data —
 * both simply mean "wrong password."
 */
// MK: never throws on a malformed hash, returns false — test covers it
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
