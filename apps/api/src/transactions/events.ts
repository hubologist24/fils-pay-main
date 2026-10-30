import type { Pool, PoolClient } from "pg";
import type { Fils } from "@filspay/money";

/**
 * Event types accepted by transaction_events.event_type (CHECK in 0018,
 * widened by 0044 for the two refund types). Amount sign convention:
 * capture types are positive, refund types are negative, authorized/voided
 * carry no amount.
 */
export type TransactionEventType =
  | "authorized"
  | "captured"
  | "partially_captured"
  | "voided"
  | "refunded"
  | "refund_partial";

// FH: amountFils for refunds must be negative (0044 CHECK). toFils needs allowNegative or it throws
export interface RecordTransactionEventInput {
  transactionId: string;
  eventType: TransactionEventType;
  /** The amount this event moved — positive for a capture delta, negative
   *  for a refund delta, so the timeline sums to the transaction's net
   *  movement; omit/null for 'authorized'/'voided', which move no money
   *  themselves. */
  amountFils?: Fils | null;
  actor: { type: "merchant_session" | "merchant_api_key" | "system"; id?: string | null };
  metadata?: Record<string, unknown>;
}

export interface TransactionEventRow {
  id: string;
  transactionId: string;
  eventType: TransactionEventType;
  amountFils: number | null;
  actorType: string;
  actorId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

/**
 * The exact insert used internally by authorize/capture/void, exposed so a
 * later refund sub-phase appends 'refunded'/'refund_partial' events through
 * this same helper rather than a second hand-rolled INSERT (after widening
 * transaction_events's CHECK, db/migrations/0018's seam).
 */
export async function recordTransactionEvent(
  client: PoolClient,
  input: RecordTransactionEventInput,
): Promise<TransactionEventRow> {
  const result = await client.query<{
    id: string;
    transaction_id: string;
    event_type: TransactionEventType;
    amount_fils: string | null;
    actor_type: string;
    actor_id: string | null;
    metadata: Record<string, unknown>;
    occurred_at: Date;
    created_at: Date;
  }>(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, actor_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, transaction_id, event_type, amount_fils, actor_type, actor_id, metadata, occurred_at, created_at`,
    [
      input.transactionId,
      input.eventType,
      input.amountFils ?? null,
      input.actor.type,
      input.actor.id ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("recordTransactionEvent: insert into transaction_events returned no row");
  }
  return {
    id: row.id,
    transactionId: row.transaction_id,
    eventType: row.event_type,
    amountFils: row.amount_fils === null ? null : Number(row.amount_fils),
    actorType: row.actor_type,
    actorId: row.actor_id,
    metadata: row.metadata,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/** Chronological (oldest-first) timeline for one transaction — a timeline
 *  reads oldest-first. Caller is responsible for the merchant-scoped
 *  existence check on the parent transaction (see routes/transactions.ts). */
// AM: ordering by occurred_at then id breaks when a refund and capture land in the same ms? FP-188
// MK: id is a uuid, the tie-break is arbitrary but stable. timeline is fine
export async function listTransactionEvents(pool: Pool, transactionId: string): Promise<TransactionEventRow[]> {
  const result = await pool.query<{
    id: string;
    transaction_id: string;
    event_type: TransactionEventType;
    amount_fils: string | null;
    actor_type: string;
    actor_id: string | null;
    metadata: Record<string, unknown>;
    occurred_at: Date;
    created_at: Date;
  }>(
    `SELECT id, transaction_id, event_type, amount_fils, actor_type, actor_id, metadata, occurred_at, created_at
       FROM transaction_events
      WHERE transaction_id = $1
      ORDER BY occurred_at ASC, id ASC`,
    [transactionId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    transactionId: row.transaction_id,
    eventType: row.event_type,
    amountFils: row.amount_fils === null ? null : Number(row.amount_fils),
    actorType: row.actor_type,
    actorId: row.actor_id,
    metadata: row.metadata,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  }));
}
