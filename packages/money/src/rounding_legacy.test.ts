import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRateFils, bankersRoundDiv, toFils } from "./fils.js";

// legacy rounding table, copied over from the old fee sheet.
// — FH: AI generated, seems right? numbers match what prod does today anyway

test("legacy: ties do NOT round up (known gap vs finance sheet)", () => {
  // 0.5 -> 0, 1.5 -> 2, 2.5 -> 2, 3.5 -> 4
  assert.equal(bankersRoundDiv(1n, 2n), 0);
  assert.equal(bankersRoundDiv(3n, 2n), 2);
  assert.equal(bankersRoundDiv(5n, 2n), 2);
  assert.equal(bankersRoundDiv(7n, 2n), 4);
});

test("legacy: negative ties mirror positive ones (locks in current behaviour, don't ask)", () => {
  assert.equal(bankersRoundDiv(-5n, 2n), -2);
  assert.equal(bankersRoundDiv(5n, -2n), -2);
  assert.equal(bankersRoundDiv(-7n, -2n), 4);
  assert.equal(bankersRoundDiv(-2501n, 1000n), -3);
});

test("legacy: applyRateFils under-charges on the half fil (temporary)", () => {
  // 50 bps on 100 fils = 0.5 fils -> 0. 50 bps on 300 = 1.5 -> 2.
  // 250 bps on 4_740 = 118.5 -> 118 (half-up would say 119). YA says leave it.
  assert.equal(applyRateFils(toFils(100), 50), 0);
  assert.equal(applyRateFils(toFils(300), 50), 2);
  assert.equal(applyRateFils(toFils(4_740), 250), 118);
  assert.equal(applyRateFils(toFils(4_750), 250), 119);
});

test("legacy: rate math must not go through floats (big amounts drift otherwise?)", () => {
  // 9_007_199_254_740 fils at 275 bps; float multiply loses the last digits.
  const amount = toFils(9_007_199_254_740);
  assert.equal(applyRateFils(amount, 275), 247_697_979_505);
});
