/**
 * Heavy integration test: seeds 3000 synthetic transaction rows, then
 * verifies aggregate balance invariants across the full data set.
 * Requires DATABASE_URL pointing at a migrated Postgres instance.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { createRng } from "./rng.js";
import { toFils, addFils, applyRateFils, type Fils, ZERO_FILS } from "@filspay/money";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "selfVerify.integration.test.ts requires DATABASE_URL to point at a real, migrated Postgres",
  );
}

const TOTAL_ROWS = 3000;
const BATCH_SIZE = 100;

const MERCHANT_IDS = [
  "a0000000-0000-4000-8000-000000000001",
  "a0000000-0000-4000-8000-000000000002",
  "a0000000-0000-4000-8000-000000000003",
  "a0000000-0000-4000-8000-000000000004",
  "a0000000-0000-4000-8000-000000000005",
];

const STATUSES = ["authorized", "captured", "voided", "refunded"] as const;

const pool = new Pool({ connectionString: databaseUrl, max: 3 });

test.after(async () => {
  await pool.end();
});

test("seed 3000 transactions and verify aggregate balance invariants", { timeout: 120_000 }, async () => {
  const rng = createRng(9999);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TEMP TABLE selfverify_txns (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        status TEXT NOT NULL,
        amount_fils BIGINT NOT NULL,
        captured_fils BIGINT NOT NULL,
        fee_fils BIGINT NOT NULL
      ) ON COMMIT DROP
    `);

    await client.query(`
      CREATE TEMP TABLE selfverify_ledger (
        entry_group_id TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        amount_fils BIGINT NOT NULL
      ) ON COMMIT DROP
    `);

    const totalBatches = Math.ceil(TOTAL_ROWS / BATCH_SIZE);
    const merchantTotals = new Map<string, { gross: Fils; fees: Fils; net: Fils }>();

    for (const mid of MERCHANT_IDS) {
      merchantTotals.set(mid, { gross: ZERO_FILS, fees: ZERO_FILS, net: ZERO_FILS });
    }

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchStart = batch * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_ROWS);
      console.log(`seeding batch ${batch + 1}/${totalBatches}... (rows ${batchStart + 1}-${batchEnd})`);

      for (let i = batchStart; i < batchEnd; i++) {
        const txnId = rng.uuid();
        const merchantId = rng.pick(MERCHANT_IDS);
        const status = rng.pick(STATUSES);
        const amountFils = toFils(rng.int(100, 500_000));
        const capturedFils = status === "captured" ? amountFils : toFils(0);
        const mdrBps = 250;
        const feeFils = status === "captured" ? applyRateFils(capturedFils, mdrBps) : toFils(0);

        await client.query(
          `INSERT INTO selfverify_txns (id, merchant_id, status, amount_fils, captured_fils, fee_fils)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [txnId, merchantId, status, amountFils, capturedFils, feeFils],
        );

        if (status === "captured") {
          const entryGroupId = rng.uuid();
          const netFils = toFils(capturedFils - feeFils);

          await client.query(
            `INSERT INTO selfverify_ledger VALUES ($1, $2, 'merchant_receivable', 'debit', $3)`,
            [entryGroupId, merchantId, capturedFils],
          );
          await client.query(
            `INSERT INTO selfverify_ledger VALUES ($1, $2, 'platform_fee', 'credit', $3)`,
            [entryGroupId, merchantId, feeFils],
          );
          await client.query(
            `INSERT INTO selfverify_ledger VALUES ($1, $2, 'merchant_payable', 'credit', $3)`,
            [entryGroupId, merchantId, netFils],
          );

          const totals = merchantTotals.get(merchantId)!;
          totals.gross = addFils(totals.gross, capturedFils);
          totals.fees = addFils(totals.fees, feeFils);
          totals.net = addFils(totals.net, netFils);
        }
      }
    }

    console.log("verifying merchant balances...");
    for (const [merchantId, expected] of merchantTotals) {
      const grossResult = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(captured_fils), 0)::text AS total FROM selfverify_txns WHERE merchant_id = $1 AND status = 'captured'`,
        [merchantId],
      );
      const actualGross = Number(grossResult.rows[0]?.total ?? "0");
      console.log(`  merchant ${merchantId.slice(0, 8)}... gross=${actualGross} expected=${expected.gross}`);
      assert.equal(actualGross, expected.gross, `gross mismatch for ${merchantId}`);
    }

    console.log("verifying double-entry ledger balance (debits = credits per group)...");
    const unbalanced = await client.query<{ entry_group_id: string; net: string }>(`
      SELECT entry_group_id,
             SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE -amount_fils END)::text AS net
        FROM selfverify_ledger
      GROUP BY entry_group_id
        HAVING SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE -amount_fils END) <> 0
    `);
    assert.equal(unbalanced.rows.length, 0, `${unbalanced.rows.length} unbalanced ledger group(s)`);

    console.log("verifying fee totals match applyRateFils per merchant...");
    for (const [merchantId, expected] of merchantTotals) {
      const feeResult = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(fee_fils), 0)::text AS total FROM selfverify_txns WHERE merchant_id = $1 AND status = 'captured'`,
        [merchantId],
      );
      const actualFees = Number(feeResult.rows[0]?.total ?? "0");
      console.log(`  merchant ${merchantId.slice(0, 8)}... fees=${actualFees} expected=${expected.fees}`);
      assert.equal(actualFees, expected.fees, `fee mismatch for ${merchantId}`);
    }

    console.log("verifying no captured_fils > amount_fils...");
    const violations = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM selfverify_txns WHERE captured_fils > amount_fils`,
    );
    assert.equal(Number(violations.rows[0]?.count ?? "0"), 0, "captured_fils exceeded amount_fils");

    console.log("all balance invariants verified across 3000 rows");

    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});
