/**
 * Tests for the platform-wide volume-tier read, against a real, migrated
 * Postgres. Every value used here is set directly on the counter row —
 * this suite never drives the settlement-side accumulator to reach one.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool, type PoolClient } from "pg";
import { getVolumeTierBonusBps } from "./platformVolumeTier.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "platformVolumeTier.test.ts requires DATABASE_URL to point at a real, migrated Postgres (run `npm run migrate` first)",
  );
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });

test.after(async () => {
  // Leave the counter where a fresh seed leaves it, so a test run never
  // changes what a subsequent settlement pass reads.
  await pool.query(`UPDATE platform_stats SET total_processed_fils = 0 WHERE id = 1`);
  await pool.end();
});

async function setTotal(totalProcessedFils: number): Promise<void> {
  await pool.query(`UPDATE platform_stats SET total_processed_fils = $1 WHERE id = 1`, [totalProcessedFils]);
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

test("no bonus at a zero counter — the state a fresh seed leaves behind", async () => {
  await setTotal(0);
  assert.equal(await withClient(getVolumeTierBonusBps), 0);
});

/** The counter is written only by apps/settlement at batch close; these tests write it directly. */
test("no bonus just below the volume tier threshold", async () => {
  await setTotal(1_999_999_999);
  assert.equal(await withClient(getVolumeTierBonusBps), 0);
});

// am: should test right at int32 max too? nvm its bigint
test("15bps once lifetime processed volume reaches the threshold", async () => {
  await setTotal(2_000_000_000);
  assert.equal(await withClient(getVolumeTierBonusBps), 15);
});

test("the tier stays granted above the threshold", async () => {
  await setTotal(2_100_000_000);
  assert.equal(await withClient(getVolumeTierBonusBps), 15);
});
