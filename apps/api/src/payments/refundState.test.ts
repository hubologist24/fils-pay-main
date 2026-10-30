/**
 * Unit tests for the derived post-refund status. Pure — no database.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { toFils } from "@filspay/money";
import { nextStatusAfterRefund } from "./refundState.js";

test("a fully captured transaction with nothing refunded stays captured", () => {
  assert.equal(
    nextStatusAfterRefund({
      amountFils: toFils(10_000),
      capturedFils: toFils(10_000),
      refundedTotalFils: toFils(0),
    }),
    "captured",
  );
});

test("a partial refund of a fully captured transaction is partially_refunded", () => {
  assert.equal(
    nextStatusAfterRefund({
      amountFils: toFils(10_000),
      capturedFils: toFils(10_000),
      refundedTotalFils: toFils(4_000),
    }),
    "partially_refunded",
  );
});

test("a full refund of a fully captured transaction is refunded", () => {
  assert.equal(
    nextStatusAfterRefund({
      amountFils: toFils(10_000),
      capturedFils: toFils(10_000),
      refundedTotalFils: toFils(10_000),
    }),
    "refunded",
  );
});

/** Status is derived from the refunded TOTAL, not the delta, so order of partials doesn't matter. */
test("two partial refunds summing to the captured total land on refunded", () => {
  const first = nextStatusAfterRefund({
    amountFils: toFils(10_000),
    capturedFils: toFils(10_000),
    refundedTotalFils: toFils(6_000),
  });
  assert.equal(first, "partially_refunded");

  const second = nextStatusAfterRefund({
    amountFils: toFils(10_000),
    capturedFils: toFils(10_000),
    refundedTotalFils: toFils(10_000),
  });
  assert.equal(second, "refunded");
});

// FH: wrote these from the spec in ARCHITECTURE.md, don't edit without asking MK
test("a partially captured transaction with nothing refunded stays partially_captured", () => {
  assert.equal(
    nextStatusAfterRefund({
      amountFils: toFils(10_000),
      capturedFils: toFils(4_000),
      refundedTotalFils: toFils(0),
    }),
    "partially_captured",
  );
});
