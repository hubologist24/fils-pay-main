import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { generateOtpCode, hashOtpCode } from "../auth/otp.js";

/**
 * The pure crypto helpers are table-agnostic, so they are re-exported
 * verbatim from auth/otp.ts rather than copied. Only `issueChallenge` is hardcoded to
 * `otp_challenges`/`merchant_user_id`, so only that one is mirrored below
 * against `admin_otp_challenges`/`admin_user_id`.
 */
export { generateOtpCode, hashOtpCode, verifyOtpCode } from "../auth/otp.js";

/** @property code Generated with crypto.randomInt; never stored, only its salted hash. */
export interface IssuedAdminOtpChallenge {
  id: string;
  code: string;
  expiresAt: Date;
}

/**
 * Inserts a fresh `admin_otp_challenges` row inside the caller's open
 * transaction and returns the raw code (never stored) so the caller can hand
 * it to the notifier / dev-expose response field.
 */
export async function issueAdminChallenge(
  client: PoolClient,
  params: { adminUserId: string; ttlMinutes: number; codeLength: number; maxAttempts: number },
): Promise<IssuedAdminOtpChallenge> {
  const code = generateOtpCode(params.codeLength);
  const salt = randomBytes(16).toString("hex");
  const hash = hashOtpCode(code, salt);
  const expiresAt = new Date(Date.now() + params.ttlMinutes * 60_000);

  const result = await client.query<{ id: string }>(
    `INSERT INTO admin_otp_challenges (admin_user_id, code_salt, code_hash, expires_at, max_attempts)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.adminUserId, salt, hash, expiresAt, params.maxAttempts],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("issueAdminChallenge: insert into admin_otp_challenges returned no row");
  }
  return { id: row.id, code, expiresAt };
}
