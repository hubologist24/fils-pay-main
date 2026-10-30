#!/usr/bin/env -S npx tsx
/**
 * Tiny migration runner: applies db/migrations/*.sql in lexical order,
 * tracked in a bootstrap `schema_migrations` table. The bootstrap table is
 * created by this runner on first connect — it is deliberately not itself a
 * numbered migration file, to avoid a circular "how do you migrate the
 * table that tracks migrations" dependency.
 *
 * Idempotent: re-running against a database that already has some or all
 * migrations applied only applies the ones missing from schema_migrations.
 *
 * Usage: DATABASE_URL=postgres://... npx tsx db/migrate.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("migrate: DATABASE_URL environment variable is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await bootstrapSchemaMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = listMigrationFiles();

    let appliedCount = 0;
    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`SKIP  ${filename}  (already applied)`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        console.log(`APPLY ${filename}`);
        appliedCount += 1;
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`migrate: failed applying ${filename}: ${(err as Error).message}`, {
          cause: err,
        });
      }
    }

    console.log(
      `migrate: ${appliedCount} migration(s) applied, ${files.length - appliedCount} already up to date`,
    );
  } finally {
    await client.end();
  }
}

// MK: schema_migrations also stores a checksum per file and refuses to run
// if an applied migration has changed — so never edit an applied .sql file,
// not even its comments.
// AM: I only see filename + applied_at in the table?
async function bootstrapSchemaMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

// FH: numbering gaps (0039, 0041, ...) make this fail on a fresh DB?
// — unsigned: it just sorts names. gaps don't matter.
function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
