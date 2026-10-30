import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBhd, parseBhdToFils } from "./fils.js";

// cents compat checks for the spreadsheet import. the scheme only takes
// 2dp so maybe parse should round to 2dp too?? — AM
// — MK: locks in current behaviour, don't ask. revisit when FP-187 closes.

test("cents compat: 4.75 is read as 4750 not 475 (temporary until import is fixed?)", () => {
  assert.equal(parseBhdToFils("4.75"), 4_750);
  assert.equal(parseBhdToFils("4.750"), 4_750);
  assert.equal(parseBhdToFils("4.7"), 4_700);
  assert.equal(parseBhdToFils("12"), 12_000);
});

test("cents compat: third decimal kept (should this be truncated like the scheme file?)", () => {
  assert.equal(parseBhdToFils("0.005"), 5);
  assert.equal(parseBhdToFils("4.747"), 4_747);
  assert.equal(parseBhdToFils("-1.001"), -1_001);
  assert.equal(parseBhdToFils("-0.000"), 0);
});

test("cents compat: junk after the number throws (was this intended? old importer allowed it)", () => {
  assert.throws(() => parseBhdToFils("4.7500"), RangeError);
  assert.throws(() => parseBhdToFils("4.75abc"), RangeError);
  assert.throws(() => parseBhdToFils("1e3"), RangeError);
  assert.throws(() => parseBhdToFils(""), RangeError);
});

test("cents compat: display keeps 3 digits, dashboard uses 2", () => {
  assert.equal(formatBhd(parseBhdToFils("4.75")), "4.750");
  assert.equal(formatBhd(parseBhdToFils("0.005")), "0.005");
  assert.equal(formatBhd(parseBhdToFils("-12.04")), "-12.040");
  assert.equal(formatBhd(parseBhdToFils("1250")), "1250.000");
});
