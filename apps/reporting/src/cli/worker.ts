import type { Pool } from "pg";
import type { ReportingConfig } from "../config.js";
import { startReportingConsumer } from "../consumer/listener.js";

/**
 * `reporting worker` — the long-running daemon subcommand,
 * the Docker container's default CMD. Starts the LISTEN/poll consumer and
 * installs SIGTERM/SIGINT handlers that stop it and close the pool before
 * exiting — identical shutdown discipline to apps/api/src/index.ts.
 */
export async function runWorker(pool: Pool, config: ReportingConfig): Promise<void> {
  const handle = startReportingConsumer(pool, config);

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[reporting/worker] received ${signal}, shutting down`);
    handle
      .stop()
      .then(() => pool.end())
      .catch((err: unknown) => {
        console.error("[reporting/worker] error during shutdown", err);
      })
      .finally(() => {
        process.exit(0);
      });
  };

  // am: exit(0) here is why docker restarts it on every deploy. or was that MK's change
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
