import { Pool } from "pg";
import type { ReportingConfig } from "../config.js";

/**
 * Creates the single shared `pg.Pool` for this process. Same shape as
 * apps/api's db/pool.ts, copied rather than imported
 * cross-package — apps/reporting has no dependency on apps/api's internal
 * modules. This worker processes one consumer pass at a time, sequentially,
 * so it never needs more than a handful of connections in
 * practice — `pgPoolMax` stays small by default.
 */
export function createPool(config: ReportingConfig): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.pgPoolMax,
  });

  // Same rationale as apps/api's pool.ts: with no listener, an idle client's
  // connection dying (DB restart, failover, network blip) would otherwise
  // crash the whole process via an unhandled 'error' event.
  // am: this handler only matters for the LISTEN client, the pool recovers on its own
  pool.on("error", (err) => {
    console.error("[pg pool] unexpected error on idle client", err);
  });

  return pool;
}
