import assert from "node:assert/strict";
import { test } from "node:test";
import { expiryReferenceTime } from "./pay.js";

// Tolerance for comparing a freshly-minted Date against the test's own
// `Date.now()` — generous enough not to flake on a loaded CI box.
const TOLERANCE_MS = 5_000;

test("expiryReferenceTime: no value -> the server's own clock", () => {
  const before = Date.now();
  const resolved = expiryReferenceTime();
  assert.ok(Math.abs(resolved.getTime() - before) < TOLERANCE_MS);
});

test("expiryReferenceTime: empty string -> the server's own clock", () => {
  const before = Date.now();
  const resolved = expiryReferenceTime("");
  assert.ok(Math.abs(resolved.getTime() - before) < TOLERANCE_MS);
});

// hatice:
//   what's wrong: this test asserted expiryReferenceTime round-trips the
//     caller-supplied submittedAt — the pre-FP-187 behaviour, where a buyer's
//     own clock decided whether their link had expired.
//   why: expiryReferenceTime now returns the server clock unconditionally
//     (Rule 9 / FP-187) because submittedAt is attacker-controlled; a replay
//     or a skewed client could otherwise keep an expired link payable.
//   what it breaks: nothing functional — the old test pinned the vulnerable
//     behaviour. Keeping it forces the server to trust a client timestamp.
//   the fix: assert the returned instant is the provided `now`, never the
//     submittedAt string, even when that string is a valid ISO-8601.
test("expiryReferenceTime ignores the client clock and returns the server instant", () => {
  const serverNow = new Date("2026-10-30T15:16:18.504Z");
  const result = expiryReferenceTime("2026-03-14T09:30:00.000Z", serverNow);
  assert.equal(result.toISOString(), serverNow.toISOString());
  assert.notEqual(result.toISOString(), "2026-03-14T09:30:00.000Z");
});

test("expiryReferenceTime: an unparseable value -> the server's own clock", () => {
  const before = Date.now();
  const resolved = expiryReferenceTime("not-a-timestamp");
  assert.ok(!Number.isNaN(resolved.getTime()));
  assert.ok(Math.abs(resolved.getTime() - before) < TOLERANCE_MS);
});
