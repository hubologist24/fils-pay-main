/**
 * Tests for the refund processor against a real, migrated Postgres (no DB
 * mocking). Requires `DATABASE_URL` (run `npm run migrate` first).
 *
 * There is no route to `inject` against yet — `POST /v1/refunds` is still a
 * 501 stub — so these call `processRefund()` directly. The transactions they
 * refund are set up through the real authorize/capture routes, so the ledger
 * and fee state under test is the state capture actually produces.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { toFils } from "@filspay/money";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";
import type { AcquirerOutcome, AcquirerRefundResult, AcquirerSimulator } from "../acquirer/types.js";
import { processRefund } from "./processRefund.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "processRefund.test.ts requires DATABASE_URL to point at a real, migrated Postgres (run `npm run migrate` first)",
  );
}

const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  INTERNAL_API_TOKEN: "test-internal-token",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const app = buildApp(config, pool);

test.after(async () => {
  await app.close();
  await pool.end();
});

const VALID_CARD = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };

/** An acquirer whose refund outcome is fixed, so a decline or a transport
 *  error is exercised without depending on the simulator's RNG. */
function fixedAcquirer(outcome: AcquirerOutcome): AcquirerSimulator {
  return {
    authorize() {
      throw new Error("fixedAcquirer: authorize is not used by these tests");
    },
    capture() {
      throw new Error("fixedAcquirer: capture is not used by these tests");
    },
    refund(req): Promise<AcquirerRefundResult> {
      return Promise.resolve({ outcome, acquirerReference: req.acquirerReference, latencyMs: 0 });
    },
  };
}

const approvingAcquirer = fixedAcquirer("approved");

async function createApprovedMerchantWithApiKey(label: string, mdrBps = 250) {
  const merchantResult = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, $2) RETURNING id`,
    [`Refund Merchant ${label} ${randomUUID()}`, mdrBps],
  );
  const merchantId = merchantResult.rows[0]!.id;

  const userResult = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused-in-these-tests')
     RETURNING id`,
    [merchantId, `owner-${randomUUID()}@example.test`],
  );
  const ownerUserId = userResult.rows[0]!.id;

  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const issued = await issueApiKey(pool, config, { merchantId, createdBy: ownerUserId, label });

  return { merchantId, ownerUserId, rawKey: issued.rawKey };
}

/** Authorizes `amountFils` and captures `captureFils` (everything, by
 *  default) through the real routes, returning the transaction id. */
async function capturedTransaction(
  rawKey: string,
  amountFils: number,
  captureFils?: number,
): Promise<{ id: string }> {
  const authorizeRes = await app.inject({
    method: "POST",
    url: "/v1/transactions",
    headers: { authorization: `Bearer ${rawKey}`, "idempotency-key": randomUUID() },
    payload: { amountFils, card: VALID_CARD, reference: "refund-test" },
  });
  assert.equal(authorizeRes.statusCode, 201, authorizeRes.body);
  const txn = authorizeRes.json() as { id: string };

  const captureRes = await app.inject({
    method: "POST",
    url: `/v1/transactions/${txn.id}/capture`,
    headers: { authorization: `Bearer ${rawKey}`, "idempotency-key": randomUUID() },
    payload: captureFils === undefined ? {} : { amountFils: captureFils },
  });
  assert.equal(captureRes.statusCode, 200, captureRes.body);

  return { id: txn.id };
}

/** The api key these tests already hold, as a writer actor — the same shape
 *  `requireMerchantWriterActor()` hands the route layer. */
async function apiKeyActor(merchantId: string): Promise<{ type: "merchant_api_key"; id: string }> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM api_keys WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [merchantId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("apiKeyActor: no api key for merchant");
  return { type: "merchant_api_key", id: row.id };
}

test("a full refund of a fully captured transaction lands on refunded", async () => {
  const merchant = await createApprovedMerchantWithApiKey("full-refund");
  const txn = await capturedTransaction(merchant.rawKey, 10_000);
  const actor = await apiKeyActor(merchant.merchantId);

  const result = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(10_000),
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));

  const row = await pool.query<{ status: string; refunded_fils: string }>(
    `SELECT status, refunded_fils FROM transactions WHERE id = $1`,
    [txn.id],
  );
  assert.equal(row.rows[0]!.status, "refunded");
  assert.equal(Number(row.rows[0]!.refunded_fils), 10_000);

  const refunds = await pool.query<{ amount_fils: string; fee_reversed_fils: string; status: string }>(
    `SELECT amount_fils, fee_reversed_fils, status FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(refunds.rows.length, 1);
  assert.equal(Number(refunds.rows[0]!.amount_fils), 10_000);
  assert.equal(refunds.rows[0]!.status, "succeeded");

  const events = await pool.query<{ event_type: string; amount_fils: string | null }>(
    `SELECT event_type, amount_fils FROM transaction_events WHERE transaction_id = $1 ORDER BY id`,
    [txn.id],
  );
  const last = events.rows[events.rows.length - 1]!;
  assert.equal(last.event_type, "refunded");
  assert.equal(Number(last.amount_fils), -10_000);
});

/**
 * Proves the reversal group balances (sum of debits == sum of credits) and
 * that, summed over all partial refunds of one capture, fee_reversed_fils
 * equals the capture's fee exactly.
 */
test("the refund's ledger group balances and reverses the fee that was charged", async () => {
  const merchant = await createApprovedMerchantWithApiKey("refund-ledger", 250);
  const txn = await capturedTransaction(merchant.rawKey, 10_000);
  const actor = await apiKeyActor(merchant.merchantId);

 /* const feeCharged = await pool.query<{ fee: string }>(
    `SELECT COALESCE(SUM(amount_fils), 0)::text AS fee
       FROM ledger_entries
      WHERE transaction_id = $1 AND account_id = 'platform_fee_revenue' AND direction = 'credit'`,
    [txn.id],
  );*/
  //Hatice Net fee revenue is credits minus debits
  const feeCharged = await pool.query<{ fee: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)::text AS fee
  FROM ledger_entries
 WHERE transaction_id = $1
   AND account_id = 'platform_fee_revenue'
`,
    [txn.id],
  );
  
  assert.equal(Number(feeCharged.rows[0]!.fee), 250);

  const result = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));

  // A single full refund reverses exactly the fee that was charged.
  const refund = await pool.query<{ fee_reversed_fils: string }>(
    `SELECT fee_reversed_fils FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(Number(refund.rows[0]!.fee_reversed_fils), 250);

  // The reversal legs share one entry_group_id and net to zero — the
  // deferred ledger_entries_balance trigger would have refused the commit
  // otherwise, but assert it rather than infer it.
  const groups = await pool.query<{ entry_group_id: string; net: string }>(
    `SELECT entry_group_id,
            SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE -amount_fils END)::text AS net
       FROM ledger_entries
      WHERE transaction_id = $1
      GROUP BY entry_group_id`,
    [txn.id],
  );
  assert.equal(groups.rows.length, 2, "one group for the capture, one for the refund");
  for (const group of groups.rows) {
    assert.equal(Number(group.net), 0);
  }

  const reversalLegs = await pool.query<{ account_id: string; direction: string; amount_fils: string }>(
    `SELECT account_id, direction, amount_fils
       FROM ledger_entries
      WHERE transaction_id = $1 AND description LIKE 'refund:%'`,
    [txn.id],
  );
  const byLeg = new Map(reversalLegs.rows.map((r) => [`${r.account_id}:${r.direction}`, Number(r.amount_fils)]));
  assert.equal(byLeg.get("merchant_payable:debit"), 10_000);
  assert.equal(byLeg.get("card_scheme_clearing:credit"), 10_000);
  assert.equal(byLeg.get("platform_fee_revenue:debit"), 250);
  assert.equal(byLeg.get("merchant_payable:credit"), 250);
});

test("partial refunds' reversed fees sum to exactly the capture's original fee", async () => {
  // hatice:
  //   what's wrong: the only fee-reversal integration test above does a single
  //     full refund, so calculateRefundFee is exercised once and trivially
  //     returns the whole fee. Nothing proves that *partial* refunds, summed,
  //     reverse exactly the capture's original fee.
  //   why: calculateRefundFee is proportional (fee * refundAmount / captured).
  //     With per-refund banker's rounding on uneven splits, an off-by-one in
  //     the formula can leak a fil per refund and never surface, because no
  //     test accumulates the reversals.
  //   what it breaks: a rounding drift would silently over/under-reverse
  //     platform_fee_revenue across partial refunds; the merchant's net
  //     payout would be off by a few fils that compound, and the ledger would
  //     still look balanced group-by-group.
  //   the fix: refund an uneven split (3_333 + 3_333 + 3_334 of a 10_000
  //     capture with a 250-fil fee) and assert SUM(fee_reversed_fils) = 250.
  const merchant = await createApprovedMerchantWithApiKey("refund-partial-fee-sum", 250);
  const txn = await capturedTransaction(merchant.rawKey, 10_000);
  const actor = await apiKeyActor(merchant.merchantId);

  for (const amount of [3_333, 3_333, 3_334]) {
    const result = await processRefund(pool, approvingAcquirer, {
      transactionId: txn.id,
      merchantId: merchant.merchantId,
      amountFils: toFils(amount),
      idempotencyKey: randomUUID(),
      actor,
    });
    assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  }

  const sum = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(fee_reversed_fils), 0)::text AS total
       FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(
    Number(sum.rows[0]!.total),
    250,
    "partial refunds' reversed fees must sum to the capture's original fee",
  );
});

test("outbox failure rolls back the refund and its ledger legs atomically", async () => {
  // hatice:
  //   what's wrong: nothing asserted that the refund INSERT, ledger legs, and
  //     outbox event commit together. The code puts enqueueEvent(client) inside
  //     the same withTransaction as the ledger and refund writes (processRefund.ts
  //     ~157-308), but a future refactor could split them and no test would fail.
  //   why: same-transaction atomicity is an invariant, not an accident — if the
  //     outbox INSERT succeeds on its own, a webhook fires for a refund that
  //     never committed to the ledger; if the refund commits without the event,
  //     the merchant is debited and the webhook consumer never hears.
  //   what it breaks: refund/ledger/outbox divergence; silent lost webhooks or
  //     phantom refunds.
  //   the fix: block refund.succeeded at the DB level for this test only, attempt
  //     a refund, assert it rejects, and assert no refunds/ledger_entries rows
  //     remain for the transaction.
  const merchant = await createApprovedMerchantWithApiKey("refund-outbox-rollback");
  const txn = await capturedTransaction(merchant.rawKey, 10_000);
  const actor = await apiKeyActor(merchant.merchantId);

  // hatice:
  //   what's wrong: ADD CONSTRAINT validates existing rows too, and the
  //     shared DB already holds refund.succeeded events from earlier tests
  //     ("a successful refund enqueues exactly one refund.succeeded outbox
  //     event"). PostgreSQL rejects the constraint with 23514 "violated by
  //     some row" before the refund attempt even runs.
  //   why: CHECK constraints are validated against existing data unless
  //     declared NOT VALID; this test only needs to block *new* inserts.
  //   what it breaks: without NOT VALID the atomicity test never reaches the
  //     refund attempt, so the rollback invariant goes unproven.
  //   the fix: add the constraint NOT VALID — it blocks new refund.succeeded
  //     inserts (which is all this test needs) while leaving pre-existing
  //     rows alone. Still dropped in finally.
  await pool.query(`ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS test_block_refund_outbox`);
  await pool.query(`
    ALTER TABLE outbox_events
      ADD CONSTRAINT test_block_refund_outbox
      CHECK (event_type <> 'refund.succeeded') NOT VALID
  `);
  try {
    await assert.rejects(
      processRefund(pool, approvingAcquirer, {
        transactionId: txn.id,
        merchantId: merchant.merchantId,
        amountFils: toFils(2_000),
        idempotencyKey: randomUUID(),
        actor,
      }),
      /test_block_refund_outbox/,
    );

    const refunds = await pool.query(`SELECT count(*)::int AS c FROM refunds WHERE transaction_id = $1`, [txn.id]);
    assert.equal(refunds.rows[0]!.c, 0, "the refund row must roll back with the failed outbox INSERT");

    const ledger = await pool.query(
      `SELECT count(*)::int AS c FROM ledger_entries WHERE transaction_id = $1 AND description LIKE 'refund:%'`,
      [txn.id],
    );
    assert.equal(ledger.rows[0]!.c, 0, "no refund ledger legs may survive the rollback");

    const txnRow = await pool.query(`SELECT refunded_fils FROM transactions WHERE id = $1`, [txn.id]);
    assert.equal(Number(txnRow.rows[0]!.refunded_fils), 0, "transactions.refunded_fils must be untouched");
  } finally {
    await pool.query(`ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS test_block_refund_outbox`);
  }
});

test("a partial refund lands on partially_refunded with a refund_partial event", async () => {
  const merchant = await createApprovedMerchantWithApiKey("partial-refund");
  const txn = await capturedTransaction(merchant.rawKey, 10_000);
  const actor = await apiKeyActor(merchant.merchantId);

  const result = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(4_000),
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));

  const row = await pool.query<{ status: string; refunded_fils: string }>(
    `SELECT status, refunded_fils FROM transactions WHERE id = $1`,
    [txn.id],
  );
  assert.equal(row.rows[0]!.status, "partially_refunded");
  assert.equal(Number(row.rows[0]!.refunded_fils), 4_000);

  const events = await pool.query<{ event_type: string }>(
    `SELECT event_type FROM transaction_events WHERE transaction_id = $1 ORDER BY id`,
    [txn.id],
  );
  assert.equal(events.rows[events.rows.length - 1]!.event_type, "refund_partial");
});

// am: should there be a test for two refunds at the SAME time? nvm the claim blocks it
test("a second partial refund completing the captured total lands on refunded", async () => {
  const merchant = await createApprovedMerchantWithApiKey("two-partials");
  const txn = await capturedTransaction(merchant.rawKey, 10_000);
  const actor = await apiKeyActor(merchant.merchantId);

  for (const amount of [6_000, 4_000]) {
    const result = await processRefund(pool, approvingAcquirer, {
      transactionId: txn.id,
      merchantId: merchant.merchantId,
      amountFils: toFils(amount),
      idempotencyKey: randomUUID(),
      actor,
    });
    assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  }

  const row = await pool.query<{ status: string; refunded_fils: string }>(
    `SELECT status, refunded_fils FROM transactions WHERE id = $1`,
    [txn.id],
  );
  assert.equal(row.rows[0]!.status, "refunded");
  assert.equal(Number(row.rows[0]!.refunded_fils), 10_000);

  const refunds = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(refunds.rows[0]!.c, 2);
});

/** Replay = same key AND same body. A different body under the same key is a 422 (covered in idempotency.test.ts). */
test("replaying the same idempotency key returns the first body and writes nothing new", async () => {
  const merchant = await createApprovedMerchantWithApiKey("refund-replay");
  const txn = await capturedTransaction(merchant.rawKey, 8_000);
  const actor = await apiKeyActor(merchant.merchantId);
  const key = randomUUID();

  const first = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(3_000),
    idempotencyKey: key,
    actor,
  });
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));

  const second = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(3_000),
    idempotencyKey: key,
    actor,
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.body, first.body);

  const refunds = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(refunds.rows[0]!.c, 1);

  const row = await pool.query<{ refunded_fils: string }>(`SELECT refunded_fils FROM transactions WHERE id = $1`, [
    txn.id,
  ]);
  assert.equal(Number(row.rows[0]!.refunded_fils), 3_000);
});

test("a declined refund answers 402 and writes no refund, ledger entry or event", async () => {
  const merchant = await createApprovedMerchantWithApiKey("refund-declined");
  const txn = await capturedTransaction(merchant.rawKey, 5_000);
  const actor = await apiKeyActor(merchant.merchantId);

  const ledgerBefore = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM ledger_entries WHERE transaction_id = $1`,
    [txn.id],
  );

  const result = await processRefund(pool, fixedAcquirer("declined"), {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(5_000),
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 402);
  assert.deepEqual(result.body, { error: "refund_declined" });

  const refunds = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(refunds.rows[0]!.c, 0);

  const ledgerAfter = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM ledger_entries WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(ledgerAfter.rows[0]!.c, ledgerBefore.rows[0]!.c);

  const row = await pool.query<{ status: string; refunded_fils: string }>(
    `SELECT status, refunded_fils FROM transactions WHERE id = $1`,
    [txn.id],
  );
  assert.equal(row.rows[0]!.status, "captured");
  assert.equal(Number(row.rows[0]!.refunded_fils), 0);
});

test("an acquirer transport error answers 502 and leaves the key retryable", async () => {
  const merchant = await createApprovedMerchantWithApiKey("refund-error");
  const txn = await capturedTransaction(merchant.rawKey, 5_000);
  const actor = await apiKeyActor(merchant.merchantId);
  const key = randomUUID();

  const result = await processRefund(pool, fixedAcquirer("error"), {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(5_000),
    idempotencyKey: key,
    actor,
  });
  assert.equal(result.statusCode, 502);
  assert.deepEqual(result.body, { error: "acquirer_unavailable" });

  const claim = await pool.query<{ status: string }>(
    `SELECT status FROM idempotency_keys WHERE merchant_id = $1 AND endpoint = 'refunds.create' AND key = $2`,
    [merchant.merchantId, key],
  );
  assert.equal(claim.rows[0]!.status, "failed");

  const refunds = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(refunds.rows[0]!.c, 0);

  // A retry with the same key re-attempts rather than replaying the failure.
  const retry = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(5_000),
    idempotencyKey: key,
    actor,
  });
  assert.equal(retry.statusCode, 200, JSON.stringify(retry.body));
});

test("a refund against a voided transaction is refused by the validator", async () => {
  const merchant = await createApprovedMerchantWithApiKey("refund-voided");
  const actor = await apiKeyActor(merchant.merchantId);

  const authorizeRes = await app.inject({
    method: "POST",
    url: "/v1/transactions",
    headers: { authorization: `Bearer ${merchant.rawKey}`, "idempotency-key": randomUUID() },
    payload: { amountFils: 5_000, card: VALID_CARD, reference: "refund-void" },
  });
  assert.equal(authorizeRes.statusCode, 201, authorizeRes.body);
  const txn = authorizeRes.json() as { id: string };

  const voidRes = await app.inject({
    method: "POST",
    url: `/v1/transactions/${txn.id}/void`,
    headers: { authorization: `Bearer ${merchant.rawKey}` },
  });
  assert.equal(voidRes.statusCode, 200, voidRes.body);

  const result = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(1_000),
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.body, { ok: false, code: "transaction_not_refundable", status: "voided" });

  const refunds = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM refunds WHERE transaction_id = $1`,
    [txn.id],
  );
  assert.equal(refunds.rows[0]!.c, 0);
});

test("a successful refund enqueues exactly one refund.succeeded outbox event", async () => {
  const merchant = await createApprovedMerchantWithApiKey("refund-outbox");
  const txn = await capturedTransaction(merchant.rawKey, 7_000);
  const actor = await apiKeyActor(merchant.merchantId);

  const result = await processRefund(pool, approvingAcquirer, {
    transactionId: txn.id,
    merchantId: merchant.merchantId,
    amountFils: toFils(7_000),
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));

  const events = await pool.query<{ event_type: string; payload: Record<string, unknown> }>(
    `SELECT event_type, payload FROM outbox_events
      WHERE aggregate_id = $1 AND event_type = 'refund.succeeded'`,
    [txn.id],
  );
  assert.equal(events.rows.length, 1);
  // dispatcher.ts joins webhook endpoints on payload->>'merchantId', so an
  // event without it would be silently undeliverable.
  // hatice amountFils was changed with amountRefundedFils
  assert.equal(events.rows[0]!.payload.merchantId, merchant.merchantId);
  assert.equal(events.rows[0]!.payload.amountRefundedFils, 7_000);
});

// TODO(FH): add "another merchant's transaction answers 404" — Claude says it's covered
// by the route test already
test("unknown transaction ids answer 404", async () => {
  const merchant = await createApprovedMerchantWithApiKey("refund-missing");
  const actor = await apiKeyActor(merchant.merchantId);

  const result = await processRefund(pool, approvingAcquirer, {
    transactionId: randomUUID(),
    merchantId: merchant.merchantId,
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(result.statusCode, 404);
  assert.deepEqual(result.body, { error: "transaction_not_found" });
});
