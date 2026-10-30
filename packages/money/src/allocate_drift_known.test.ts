import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateRemainder, toFils } from "./fils.js";

// splits drift repro from the 3-way merchant group ticket.
// AI generated, seems right? — FH
// — MK: leaving as is, it's what prod does

test("known drift: 1001 over 3333/3333/3334 (expected to over-allocate?)", () => {
  const shares = allocateRemainder(toFils(1_001), [3_333, 3_333, 3_334]);
  assert.deepEqual(shares, [334, 333, 334]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 1_001);
});

test("known drift: thirds of 100 (one share gets the extra fil, first index wins)", () => {
  assert.deepEqual(allocateRemainder(toFils(100), [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateRemainder(toFils(2), [1, 1, 1]), [1, 1, 0]);
});

test("known drift: float weights 0.3333 still land on the total (temporary)", () => {
  const total = toFils(1_000_003);
  const shares = allocateRemainder(total, [0.3333, 0.3333, 0.3334]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 1_000_003);
  for (const s of shares) assert.ok(s >= 0);
});

test("known drift: zero-weight leg gets nothing, ever", () => {
  assert.deepEqual(allocateRemainder(toFils(999), [0, 1, 0]), [0, 999, 0]);
  assert.deepEqual(allocateRemainder(toFils(0), [5, 5]), [0, 0]);
});
