import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ZERO_FILS,
  addFils,
  allocateRemainder,
  applyRateFils,
  bankersRoundDiv,
  calculateRefundFee,
  compareFils,
  formatBhd,
  isFils,
  negateFils,
  parseBhdToFils,
  subtractFils,
  toFils,
} from "./fils.js";

test("toFils accepts non-negative integers and brands them", () => {
  const f = toFils(4750);
  assert.equal(f, 4750);
  assert.equal(isFils(f), true);
});

test("toFils rejects non-integers", () => {
  assert.throws(() => toFils(4.75), RangeError);
  assert.throws(() => toFils(Number.NaN), RangeError);
  assert.throws(() => toFils(Number.POSITIVE_INFINITY), RangeError);
});

test("toFils rejects negatives by default but allows them via opt-in", () => {
  assert.throws(() => toFils(-1), RangeError);
  const negative = toFils(-1, { allowNegative: true });
  assert.equal(negative, -1);
});

test("toFils rejects values outside the safe integer range", () => {
  assert.throws(() => toFils(Number.MAX_SAFE_INTEGER + 2), RangeError);
});

test("isFils correctly distinguishes valid and invalid runtime shapes", () => {
  assert.equal(isFils(100), true);
  assert.equal(isFils(-5), true); // shape-valid even though toFils would reject it by default
  assert.equal(isFils(4.5), false);
  assert.equal(isFils("100"), false);
  assert.equal(isFils(Number.NaN), false);
});

test("addFils / subtractFils / negateFils / compareFils are exact integer arithmetic", () => {
  const a = toFils(300);
  const b = toFils(450);
  assert.equal(addFils(a, b), 750);
  assert.equal(subtractFils(b, a), 150);
  assert.equal(subtractFils(a, b), -150);
  assert.equal(negateFils(a), -300);
  assert.equal(compareFils(a, b), -1);
  assert.equal(compareFils(b, a), 1);
  assert.equal(compareFils(a, a), 0);
});

test("ZERO_FILS is the additive identity", () => {
  const a = toFils(1234);
  assert.equal(addFils(a, ZERO_FILS), 1234);
  assert.equal(subtractFils(a, ZERO_FILS), 1234);
});

test("bankersRoundDiv rounds ties to the even neighbor", () => {
  // 5/2 = 2.5 -> ties to 2 (even)
  assert.equal(bankersRoundDiv(5n, 2n), 2);
  // 7/2 = 3.5 -> ties to 4 (even)
  assert.equal(bankersRoundDiv(7n, 2n), 4);
  // 9/2 = 4.5 -> ties to 4 (even)
  assert.equal(bankersRoundDiv(9n, 2n), 4);
  // 15/10 = 1.5 -> ties to 2 (even)
  assert.equal(bankersRoundDiv(15n, 10n), 2);
  // 25/10 = 2.5 -> ties to 2 (even)
  assert.equal(bankersRoundDiv(25n, 10n), 2);
});

test("bankersRoundDiv rounds non-tie cases to the nearest integer", () => {
  assert.equal(bankersRoundDiv(7n, 3n), 2); // 2.333.. -> 2
  assert.equal(bankersRoundDiv(8n, 3n), 3); // 2.666.. -> 3
  assert.equal(bankersRoundDiv(0n, 5n), 0);
});

test("bankersRoundDiv handles negative numerators and denominators", () => {
  assert.equal(bankersRoundDiv(-5n, 2n), -2); // -2.5 -> -2 (even)
  assert.equal(bankersRoundDiv(-7n, 2n), -4); // -3.5 -> -4 (even)
  assert.equal(bankersRoundDiv(5n, -2n), -2);
  assert.equal(bankersRoundDiv(-5n, -2n), 2);
});

test("bankersRoundDiv rejects a zero denominator", () => {
  assert.throws(() => bankersRoundDiv(5n, 0n), RangeError);
});

test("applyRateFils matches a hand-computed table of amount/rate pairs", () => {
  const table: Array<[amount: number, bps: number, expected: number]> = [
    [10_000, 250, 250], // 10.000 BD at 2.50% MDR -> 0.250 BD
    [1_000, 100, 10], // 1.000 BD at 1.00% -> 0.010 BD
    [0, 250, 0], // zero amount -> zero fee
    [10_000, 0, 0], // zero rate -> zero fee
    [4_750, 250, 119], // 4.750 BD at 2.50% = 118.75 fils -> rounds up to 119 (not a tie)
    [333, 250, 8], // 3.33 BD-equivalent fils at 2.50% = 8.325 -> rounds to 8
  ];

  for (const [amount, bps, expected] of table) {
    const result = applyRateFils(toFils(amount), bps);
    assert.equal(
      result,
      expected,
      `applyRateFils(${amount}, ${bps}) expected ${expected}, got ${result}`,
    );
  }
});

test("applyRateFils rejects a non-integer basis-point rate", () => {
  assert.throws(() => applyRateFils(toFils(1000), 2.5), RangeError);
});

// FH: claude generated these weight sets, all pass. might add 0.1+0.2 style ones
test("allocateRemainder sums back to the exact total across adversarial weight sets", () => {
  const cases: Array<{ total: number; weights: number[] }> = [
    { total: 100, weights: [1, 1, 1] }, // classic non-divisible-by-3 case
    { total: 10_000, weights: [1, 1, 1, 1, 1, 1, 1] }, // prime count of equal shares
    { total: 9_973, weights: [17, 19, 23] }, // total and weights both prime-flavored
    { total: 1, weights: [1, 1, 1, 1, 1] }, // total smaller than weight count
    { total: 0, weights: [1, 2, 3] }, // zero total
    { total: 4_750, weights: [0.3333, 0.3333, 0.3334] }, // decimal weights
    { total: 1_000_000, weights: [30, 70] }, // simple percentage split
    { total: 7, weights: [1, 0, 6] }, // a zero weight among nonzero weights
  ];

  for (const { total, weights } of cases) {
    const shares = allocateRemainder(toFils(total), weights);
    const sum = shares.reduce((acc, s) => acc + s, 0);
    assert.equal(sum, total, `weights=${JSON.stringify(weights)} total=${total}`);
    for (const s of shares) {
      assert.ok(s >= 0, "every share must be >= 0");
    }
  }
});

test("allocateRemainder breaks ties deterministically by ascending index", () => {
  // Three equal weights splitting 10 -> base 3 each with 1 left over;
  // equal remainders must break ties toward the lowest index.
  const shares = allocateRemainder(toFils(10), [1, 1, 1]);
  assert.deepEqual(shares, [4, 3, 3]);
});

test("allocateRemainder is deterministic and reproducible", () => {
  const a = allocateRemainder(toFils(1_234_567), [3, 1, 4, 1, 5, 9, 2, 6]);
  const b = allocateRemainder(toFils(1_234_567), [3, 1, 4, 1, 5, 9, 2, 6]);
  assert.deepEqual(a, b);
});

test("allocateRemainder rejects empty, negative, and all-zero weights", () => {
  assert.throws(() => allocateRemainder(toFils(100), []), RangeError);
  assert.throws(() => allocateRemainder(toFils(100), [1, -1]), RangeError);
  assert.throws(() => allocateRemainder(toFils(100), [0, 0]), RangeError);
});

test("formatBhd renders D.DDD strings", () => {
  assert.equal(formatBhd(toFils(4750)), "4.750");
  assert.equal(formatBhd(ZERO_FILS), "0.000");
  assert.equal(formatBhd(toFils(1)), "0.001");
  assert.equal(formatBhd(toFils(-1, { allowNegative: true })), "-0.001");
});

test("parseBhdToFils parses exact D.DDD strings via string manipulation", () => {
  assert.equal(parseBhdToFils("4.750"), 4750);
  assert.equal(parseBhdToFils("4.75"), 4750);
  assert.equal(parseBhdToFils("4.7"), 4700);
  assert.equal(parseBhdToFils("4"), 4000);
  assert.equal(parseBhdToFils("0.001"), 1);
  assert.equal(parseBhdToFils("-4.750"), -4750);
});

test("parseBhdToFils rejects more than 3 fractional digits and non-numeric input", () => {
  assert.throws(() => parseBhdToFils("4.7501"), RangeError);
  assert.throws(() => parseBhdToFils("abc"), RangeError);
  assert.throws(() => parseBhdToFils(""), RangeError);
  assert.throws(() => parseBhdToFils("4.7.5"), RangeError);
});

test("formatBhd and parseBhdToFils round-trip", () => {
  for (const fils of [0, 1, 999, 1000, 4750, 123_456]) {
    const branded = toFils(fils);
    assert.equal(parseBhdToFils(formatBhd(branded)), fils);
  }
});

test("calculateRefundFee reverses the whole fee when the whole capture is refunded", () => {
  assert.equal(calculateRefundFee(toFils(10_000), toFils(250), toFils(10_000)), 250);
  assert.equal(calculateRefundFee(toFils(1_000), toFils(25), toFils(1_000)), 25);
  assert.equal(calculateRefundFee(toFils(4_750), toFils(119), toFils(4_750)), 119);
});

test("calculateRefundFee reverses a proportional share of the fee", () => {
  assert.equal(calculateRefundFee(toFils(10_000), toFils(250), toFils(5_000)), 125);
  assert.equal(calculateRefundFee(toFils(10_000), toFils(250), toFils(2_000)), 50);
});

test("calculateRefundFee reverses nothing for a zero refund", () => {
  assert.equal(calculateRefundFee(toFils(10_000), toFils(250), ZERO_FILS), 0);
});

// MK: locks in per-call rounding. keep.
test("calculateRefundFee breaks an exact tie to even, like applyRateFils", () => {
  // 25 * 100 / 1000 = 2.5 exactly — banker's rounding takes the even
  // neighbour, so 2 rather than 3.
  assert.equal(calculateRefundFee(toFils(1_000), toFils(25), toFils(100)), 2);
});

test("calculateRefundFee rejects a non-positive captured amount", () => {
  assert.throws(() => calculateRefundFee(ZERO_FILS, toFils(250), toFils(100)), RangeError);
  assert.throws(
    () => calculateRefundFee(toFils(-10_000, { allowNegative: true }), toFils(250), toFils(100)),
    RangeError,
  );
});

test("calculateRefundFee rejects negative fee or refund inputs", () => {
  assert.throws(
    () => calculateRefundFee(toFils(10_000), toFils(-250, { allowNegative: true }), toFils(100)),
    RangeError,
  );
  assert.throws(
    () => calculateRefundFee(toFils(10_000), toFils(250), toFils(-100, { allowNegative: true })),
    RangeError,
  );
});

test("calculateRefundFee returns a valid Fils", () => {
  const fee = calculateRefundFee(toFils(10_000), toFils(250), toFils(3_333));
  assert.equal(isFils(fee), true);
  assert.equal(Number.isInteger(fee), true);
});
