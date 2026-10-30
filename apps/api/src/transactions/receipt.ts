import type { Pool } from "pg";
import { formatBhd, toFils } from "@filspay/money";

export interface TransactionReceipt {
  transactionId: string;
  status: string;
  amountBhd: string;
  capturedBhd: string;
  reference: string;
  occurredAt: string;
}

/**
 * Fetches the receipt-facing view of a single transaction, used by the
 * customer-facing receipt page (checkout/:token/receipt). The checkout
 * flow authenticates via the payment-link token, not a merchant session,
 * so the caller has already resolved the transaction id from the
 * payment_link row — this is a trusted internal lookup.
 */
export async function getTransactionForReceipt(
  pool: Pool,
  transactionId: string,
): Promise<TransactionReceipt | null> {
  const result = await pool.query<{
    id: string;
    status: string;
    amount_fils: string;
    captured_fils: string;
    reference: string | null;
    occurred_at: Date;
  }>(
    `SELECT id, status, amount_fils, captured_fils, reference, occurred_at
       FROM transactions WHERE id = $1`,
    [transactionId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    transactionId: row.id,
    status: row.status,
    amountBhd: formatBhd(toFils(Number(row.amount_fils))),
    capturedBhd: formatBhd(toFils(Number(row.captured_fils))),
    reference: row.reference ?? "",
    occurredAt: row.occurred_at.toISOString(),
  };
}
