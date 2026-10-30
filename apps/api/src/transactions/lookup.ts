import type { Pool } from "pg";

export interface TransactionRow {
  id: string;
  merchant_id: string;
  status: string;
  amount_fils: string;
  captured_fils: string;
  refunded_fils: string;
  created_at: Date;
}

/** Looks up a transaction by id without merchant scoping — used by system
 *  actors (acquirer callbacks, event processors) that already hold the
 *  transaction id from a trusted source. */
export async function findTransactionById(
  pool: Pool,
  transactionId: string,
): Promise<TransactionRow | null> {
  const result = await pool.query<TransactionRow>(
    `SELECT id, merchant_id, status, amount_fils, captured_fils, refunded_fils, created_at
       FROM transactions
      WHERE id = $1`,
    [transactionId],
  );
  return result.rows[0] ?? null;
}
