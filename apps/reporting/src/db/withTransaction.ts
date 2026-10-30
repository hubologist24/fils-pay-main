import type { Pool, PoolClient } from "pg";

/**
 * Checks out a client from `pool`, runs `fn` inside a `BEGIN`/`COMMIT`
 * transaction, and rolls back on any error — always releasing the client
 * back to the pool. Identical shape to apps/api's db/withTransaction.ts,
 * copied rather than imported cross-package.
 *
 * `runConsumerPass` (consumer/runConsumerPass.ts) is this module's one
 * load-bearing caller: the read of due outbox_events, every rollup upsert
 * `applyEvent` performs, and the watermark advance all happen inside a
 * single call to this function, which is what makes the watermark alone
 * sufficient for exactly-once application.
 */
/**
 * If ROLLBACK itself fails, the original error is still the one rethrown.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  // MK: copy of apps/api/src/db/withTransaction.ts, keep the two in sync
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}
