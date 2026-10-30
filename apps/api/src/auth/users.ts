import type { Pool } from "pg";

interface MerchantUserRow {
  id: string;
  merchant_id: string;
  email: string;
  role: "owner" | "finance" | "support";
}

/** Finds the OTP recipient for the given email across all active merchants. */
export async function findOtpRecipient(
  pool: Pool,
  email: string,
): Promise<MerchantUserRow | null> {
  const result = await pool.query<MerchantUserRow>(
    `SELECT mu.id, mu.merchant_id, mu.email, mu.role
       FROM merchant_users mu
       JOIN merchants m ON m.id = mu.merchant_id
      WHERE mu.email = $1 AND m.status = 'active'
      LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}
