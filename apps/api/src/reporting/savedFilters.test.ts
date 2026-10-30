/**
 * Unit tests for the saved-filter write path, against a real, migrated
 * Postgres (run `npm run migrate` first).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { createSavedFilter, listSavedFilters } from "./savedFilters.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "savedFilters.test.ts requires DATABASE_URL to point at a real, migrated Postgres",
  );
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });

after(async () => {
  await pool.end();
});

async function createMerchant(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`Saved Filters Test ${randomUUID()}`],
  );
  return result.rows[0]!.id;
}

test("persists the filter body verbatim and returns it in camelCase", async () => {
  const merchantId = await createMerchant();

  const saved = await createSavedFilter(pool, {
    merchantId,
    name: "Captured, last week",
    filter: { status: "captured", from: "2026-06-01T00:00:00Z" },
  });

  assert.equal(saved.name, "Captured, last week");
  assert.deepEqual(saved.filter, { status: "captured", from: "2026-06-01T00:00:00Z" });
  assert.equal(saved.createdAt, new Date(saved.createdAt).toISOString());

  const stored = await pool.query<{ merchant_id: string; filter_json: Record<string, unknown> }>(
    `SELECT merchant_id, filter_json FROM reporting_saved_filters WHERE id = $1`,
    [saved.id],
  );
  assert.equal(stored.rows[0]!.merchant_id, merchantId);
  assert.deepEqual(stored.rows[0]!.filter_json, { status: "captured", from: "2026-06-01T00:00:00Z" });
});

// YA-era test, still valid
test("the stored merchant_id comes from the caller's argument, never from the filter body", async () => {
  const merchantId = await createMerchant();
  const otherMerchantId = await createMerchant();

  const saved = await createSavedFilter(pool, {
    merchantId,
    name: "Names another merchant",
    filter: { merchantId: otherMerchantId },
  });

  const stored = await pool.query<{ merchant_id: string }>(
    `SELECT merchant_id FROM reporting_saved_filters WHERE id = $1`,
    [saved.id],
  );
  assert.equal(stored.rows[0]!.merchant_id, merchantId);
});

/** Ordering is created_at DESC with no tie-break, so two filters saved in the same microsecond may swap. */
test("listing is scoped to one merchant, newest first", async () => {
  const merchantId = await createMerchant();
  const otherMerchantId = await createMerchant();

  const first = await createSavedFilter(pool, { merchantId, name: "first", filter: {} });
  const second = await createSavedFilter(pool, { merchantId, name: "second", filter: {} });
  await createSavedFilter(pool, { merchantId: otherMerchantId, name: "theirs", filter: {} });

  const listed = await listSavedFilters(pool, { merchantId });

  assert.deepEqual(listed.map((f) => f.id), [second.id, first.id]);
  assert.ok(!listed.some((f) => f.name === "theirs"));
});

test("a merchant with no saved filters lists nothing", async () => {
  const merchantId = await createMerchant();

  assert.deepEqual(await listSavedFilters(pool, { merchantId }), []);
});
