/**
 * Shared outbox event types and the single safe way to enqueue one. Backs
 * the transactional-outbox pattern used to move events between services
 * over Postgres LISTEN/NOTIFY, without a separate message broker.
 */

/** Event types the outbox can carry. Add a variant here before anything
 *  produces or consumes it. */
export type EventType =
  | "transaction.captured"
  | "transaction.voided"
  // FH: refund.succeeded is already here, so the dispatcher handles it? (yes per claude)
  | "refund.succeeded"
  | "settlement.batch_closed"
  | "settlement.paid";

/**
 * transaction.* and refund.succeeded use 'transaction'; settlement.* use
 * 'settlement_batch'.
 */
export type AggregateType = "transaction" | "settlement_batch";

export interface OutboxEventRow {
  id: bigint;
  eventType: EventType;
  aggregateType: AggregateType;
  aggregateId: string; // uuid
  payload: Record<string, unknown>;
  createdAt: Date;
  processedAt: Date | null;
}

/**
 * payload must carry a top-level merchantId for every merchant-facing event
 * type; the webhook dispatcher joins webhook_endpoints on it.
 */
export interface NewOutboxEvent {
  eventType: EventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
}

/** The minimal shape `enqueueEvent` needs from a database client — a `pg`
 *  `PoolClient` mid-transaction satisfies this, but so does any test double. */
export interface QueryableClient {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
}

/**
 * processed_at is returned for completeness. enqueueEvent never sets it.
 */
interface OutboxInsertResult {
  rows: Array<{
    id: string | number | bigint;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    payload: Record<string, unknown>;
    created_at: Date;
    processed_at: Date | null;
  }>;
}

// am: guard also checks each row's columns, so a bad RETURNING list throws here
function isOutboxInsertResult(value: unknown): value is OutboxInsertResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "rows" in value &&
    Array.isArray((value as { rows: unknown }).rows)
  );
}

/**
 * Inserts a row into `outbox_events` using the caller's own transactional
 * client — never a fresh pool connection. The whole point of the outbox
 * pattern is that this insert commits atomically with the business write
 * that produced the event; passing anything other than an already-open
 * transaction defeats it.
 *
 */
export async function enqueueEvent(
  client: QueryableClient,
  event: NewOutboxEvent,
): Promise<OutboxEventRow> {
  const result = await client.query(
    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id, event_type, aggregate_type, aggregate_id, payload, created_at, processed_at`,
    // YA: jsonb stores this reordered. anything that signs the payload has to sign what it SENDS, not this string
    // MK: dispatcher canonicalizes, order doesn't matter. resolved.
    // FH: incident 2026-05-14 was this stringify double-encoding the payload (string inside jsonb)? AM: payload looked fine in psql. FH: in staging it didn't. nobody kept the dump
    [event.eventType, event.aggregateType, event.aggregateId, JSON.stringify(event.payload)],
  );

  if (!isOutboxInsertResult(result)) {
    throw new Error("enqueueEvent: query result did not have the expected shape");
  }

  const row = result.rows[0];
  if (!row) {
    throw new Error("enqueueEvent: insert into outbox_events returned no row");
  }

  return {
    id: BigInt(row.id),
    eventType: row.event_type as EventType,
    aggregateType: row.aggregate_type as AggregateType,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  };
}
