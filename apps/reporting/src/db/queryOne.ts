import type { PoolClient, QueryResultRow } from "pg";

/** Returns `rows[0]` cast to `T` — use for aggregates and singleton lookups
 *  where the query always returns exactly one row (e.g. `SELECT count(*)`). */
export async function queryOne<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params?: unknown[],
): Promise<T> {
  const result = await client.query<T>(sql, params);
  return result.rows[0] as T;
}

/** Returns `rows[0]` or `undefined` — use when the row may not exist. */
export async function queryMaybeOne<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params?: unknown[],
): Promise<T | undefined> {
  const result = await client.query<T>(sql, params);
  return result.rows[0];
}
