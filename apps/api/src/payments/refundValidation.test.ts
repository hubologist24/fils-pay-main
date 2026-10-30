/**
 * Unit tests for the refund validator. Pure arithmetic and status rules —
 * no database, no acquirer, no app.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { toFils } from "@filspay/money";
import { refundableAmount, validateRefundRequest, type RefundableTransaction } from "./refundValidation.js";

function txn(overrides: {
  status: string;
  amountFils: number;
  capturedFils: number;
  refundedFils?: number;
}): RefundableTransaction {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    status: overrides.status,
    capturedFils: toFils(overrides.capturedFils),
    refundableFils: toFils(overrides.amountFils - (overrides.refundedFils ?? 0)),
  };
}

test("a fully captured transaction can be refunded in full", () => {
  const result = validateRefundRequest(
    txn({ status: "captured", amountFils: 10_000, capturedFils: 10_000 }),
    toFils(10_000),
  );
  assert.deepEqual(result, { ok: true, amountFils: 10_000 });
});

test("omitting the amount refunds everything still refundable", () => {
  const result = validateRefundRequest(txn({ status: "captured", amountFils: 10_000, capturedFils: 10_000 }));
  assert.deepEqual(result, { ok: true, amountFils: 10_000 });
});

test("a fully captured transaction can be refunded in part", () => {
  const result = validateRefundRequest(
    txn({ status: "captured", amountFils: 10_000, capturedFils: 10_000 }),
    toFils(5_000),
  );
  assert.deepEqual(result, { ok: true, amountFils: 5_000 });
});

test("a second partial refund completing the captured total is accepted", () => {
  const result = validateRefundRequest(
    txn({ status: "partially_refunded", amountFils: 10_000, capturedFils: 10_000, refundedFils: 6_000 }),
    toFils(4_000),
  );
  assert.deepEqual(result, { ok: true, amountFils: 4_000 });
});

// MK: name is misleading, it can refund up to the authorized amount. rename later
test("a partially captured transaction can refund what it captured", () => {
  const result = validateRefundRequest(
    txn({ status: "partially_captured", amountFils: 10_000, capturedFils: 4_000 }),
    toFils(4_000),
  );
  assert.deepEqual(result, { ok: true, amountFils: 4_000 });
});

test("a zero or negative refund amount is rejected", () => {
  const captured = txn({ status: "captured", amountFils: 10_000, capturedFils: 10_000 });
  assert.deepEqual(validateRefundRequest(captured, toFils(0)), { ok: false, code: "refund_amount_invalid" });
  assert.deepEqual(validateRefundRequest(captured, toFils(-1, { allowNegative: true })), {
    ok: false,
    code: "refund_amount_invalid",
  });
});

/** Ceiling here is amount_fils - refunded_fils, i.e. the authorized amount, by design (see refundableAmount). */
test("a refund above the refundable ceiling is rejected with the ceiling", () => {
  const result = validateRefundRequest(
    txn({ status: "captured", amountFils: 10_000, capturedFils: 10_000, refundedFils: 2_000 }),
    toFils(8_001),
  );
  assert.deepEqual(result, { ok: false, code: "refund_exceeds_refundable", refundableFils: 8_000 });
});

test("an already fully refunded transaction has nothing left to return", () => {
  const spent = txn({
    status: "partially_refunded",
    amountFils: 10_000,
    capturedFils: 10_000,
    refundedFils: 10_000,
  });
  assert.equal(refundableAmount(spent), 0);
  assert.deepEqual(validateRefundRequest(spent, toFils(1)), {
    ok: false,
    code: "refund_exceeds_refundable",
    refundableFils: 0,
  });
});

test("voided, authorized and chargeback transactions are not refundable", () => {
  for (const status of ["voided", "authorized", "chargeback"]) {
    const result = validateRefundRequest(txn({ status, amountFils: 10_000, capturedFils: 0 }), toFils(1_000));
    assert.deepEqual(result, { ok: false, code: "transaction_not_refundable", status });
  }
});

test("a transaction that captured nothing is not refundable even in a refundable status", () => {
  const result = validateRefundRequest(
    txn({ status: "captured", amountFils: 10_000, capturedFils: 0 }),
    toFils(1_000),
  );
  assert.deepEqual(result, { ok: false, code: "transaction_not_refundable", status: "captured" });
});
