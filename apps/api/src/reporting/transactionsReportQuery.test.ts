/**
 * Unit tests for the ad-hoc transactions report query, against a real,
 * migrated Postgres (run `npm run migrate` first).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { runTransactionsReport } from "./transactionsReportQuery.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "transactionsReportQuery.test.ts requires DATABASE_URL to point at a real, migrated Postgres",
  );
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });

after(async () => {
  await pool.end();
});

async function createMerchant(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`Reporting Query Test ${randomUUID()}`],
  );
  return result.rows[0]!.id;
}

async function insertTransaction(
  merchantId: string,
  opts: { status: string; amountFils: number; capturedFils: number; reference: string; occurredAt: string },
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, reference, acquirer_reference, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      merchantId,
      opts.status,
      opts.amountFils,
      opts.capturedFils,
      opts.reference,
      `acq_${randomUUID()}`,
      opts.occurredAt,
    ],
  );
  return result.rows[0]!.id;
}

/** Two merchants, each with one captured and one voided transaction. */
async function seedPair() {
  const merchantA = await createMerchant();
  const merchantB = await createMerchant();

  const aCaptured = await insertTransaction(merchantA, {
    status: "captured",
    amountFils: 12500,
    capturedFils: 12500,
    reference: "a-captured",
    occurredAt: "2026-06-02T10:00:00Z",
  });
  const aVoided = await insertTransaction(merchantA, {
    status: "voided",
    amountFils: 3000,
    capturedFils: 0,
    reference: "a-voided",
    occurredAt: "2026-06-01T10:00:00Z",
  });
  await insertTransaction(merchantB, {
    status: "captured",
    amountFils: 7000,
    capturedFils: 7000,
    reference: "b-captured",
    occurredAt: "2026-06-02T11:00:00Z",
  });

  return { merchantA, merchantB, aCaptured, aVoided };
}

// FH: "named merchant" = the merchant in the filter. this is intended for the marketplace case (MK)
test("returns the named merchant's rows, newest first, in the API's money shape", async () => {
  const { merchantA, aCaptured, aVoided } = await seedPair();

  const rows = await runTransactionsReport(pool, { merchantId: merchantA });

  assert.deepEqual(rows.map((r) => r.id), [aCaptured, aVoided]);
  assert.ok(rows.every((r) => r.merchantId === merchantA));
  assert.equal(rows[0]!.amountBhd, "12.500");
  assert.equal(rows[0]!.capturedBhd, "12.500");
  assert.equal(rows[0]!.reference, "a-captured");
  assert.equal(rows[0]!.occurredAt, "2026-06-02T10:00:00.000Z");
});

test("a filter with no status narrows nothing — every status the merchant has is reported", async () => {
  const { merchantA } = await seedPair();

  const rows = await runTransactionsReport(pool, { merchantId: merchantA });

  assert.deepEqual(new Set(rows.map((r) => r.status)), new Set(["captured", "voided"]));
});

test("a status filter narrows to that status", async () => {
  const { merchantA, aCaptured } = await seedPair();

  const captured = await runTransactionsReport(pool, { merchantId: merchantA, status: "captured" });
  assert.deepEqual(captured.map((r) => r.id), [aCaptured]);

  const voided = await runTransactionsReport(pool, { merchantId: merchantA, status: "voided" });
  assert.deepEqual(voided.map((r) => r.reference), ["a-voided"]);
});

/** Only well-formed dates are exercised here; quoting/escaping of filter values is not covered. */
test("from/to narrow the reported range, upper bound exclusive", async () => {
  const { merchantA, aVoided } = await seedPair();

  const rows = await runTransactionsReport(pool, {
    merchantId: merchantA,
    from: "2026-06-01T00:00:00Z",
    to: "2026-06-02T10:00:00Z",
  });

  assert.deepEqual(rows.map((r) => r.id), [aVoided]);
});

test("reports nothing for a merchant with no transactions", async () => {
  const merchantId = await createMerchant();

  const rows = await runTransactionsReport(pool, { merchantId });

  assert.deepEqual(rows, []);
});
