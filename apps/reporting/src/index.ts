import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { runWorker } from "./cli/worker.js";
import { runCatchUp } from "./cli/catchUp.js";
import { runRebuild } from "./cli/rebuild.js";

/**
 * apps/reporting's entrypoint. A pure background worker
 * with no HTTP server — connects directly to the same Postgres database as
 * apps/api/apps/settlement. Subcommand dispatch: `worker` (default,
 * long-running daemon), `catch-up` (one-shot backfill), `rebuild`
 * (one-shot, CLI-only recovery tool — never auto-invoked, never
 * HTTP-exposed).
 */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const pool = createPool(config);
  await pool.query("SELECT 1"); // fail fast if DB unreachable at boot

  const [, , subcommand] = process.argv;
  switch (subcommand ?? "worker") {
    case "worker":
      // Long-running: manages its own pool.end() on SIGTERM/SIGINT, never here.
      return runWorker(pool, config);
    case "catch-up":
      // One-shot: this entrypoint owns closing the pool once the subcommand
      // function returns, so runCatchUp itself stays pool-lifecycle-agnostic
      // (and directly unit-testable against a shared, long-lived test pool).
      await runCatchUp(pool, config);
      return pool.end();
    case "rebuild":
      await runRebuild(pool, config);
      return pool.end();
    default:
      console.error(`unknown subcommand: ${subcommand}`);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
