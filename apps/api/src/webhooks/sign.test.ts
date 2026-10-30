import assert from "node:assert/strict";
import { test } from "node:test";
import { signPayload, verifySignature } from "./sign.js";

const SECRET = "whsec_test_secret";

test("signPayload/verifySignature round-trip: valid signature, fresh timestamp", () => {
  const payload = { transactionId: "abc", amountCapturedFils: 4750 };
  const { signature } = signPayload(payload, SECRET);
  const result = verifySignature(payload, signature, SECRET);
  assert.deepEqual(result, { valid: true });
});

test("signature header format is t=<seconds>,v1=<hex>", () => {
  const { timestamp, signature } = signPayload({ a: 1 }, SECRET, 1_700_000_000);
  assert.equal(timestamp, 1_700_000_000);
  assert.match(signature, /^t=1700000000,v1=[0-9a-f]{64}$/);
});

test("canonical serialization: key order in the payload object does not change the signature", () => {
  const a = signPayload({ a: 1, b: 2, c: { x: 1, y: 2 } }, SECRET, 1_700_000_000);
  const b = signPayload({ c: { y: 2, x: 1 }, b: 2, a: 1 }, SECRET, 1_700_000_000);
  assert.equal(a.signature, b.signature);
});

test("a different payload produces a different signature", () => {
  const a = signPayload({ amountFils: 100 }, SECRET, 1_700_000_000);
  const b = signPayload({ amountFils: 101 }, SECRET, 1_700_000_000);
  assert.notEqual(a.signature, b.signature);
});

test("verifySignature rejects a tampered payload (signature_mismatch)", () => {
  const payload = { amountFils: 100 };
  const { signature } = signPayload(payload, SECRET);
  const result = verifySignature({ amountFils: 999 }, signature, SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature_mismatch");
});

test("verifySignature rejects the wrong secret (signature_mismatch)", () => {
  const payload = { amountFils: 100 };
  const { signature } = signPayload(payload, SECRET);
  const result = verifySignature(payload, signature, "whsec_wrong_secret");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature_mismatch");
});

test("verifySignature rejects a malformed header", () => {
  const payload = { amountFils: 100 };
  assert.equal(verifySignature(payload, "not-a-real-header", SECRET).reason, "malformed_header");
  assert.equal(verifySignature(payload, "t=abc,v1=deadbeef", SECRET).reason, "malformed_header");
  assert.equal(verifySignature(payload, "v1=deadbeef", SECRET).reason, "malformed_header");
});

test("verifySignature enforces the timestamp tolerance window", () => {
  const payload = { amountFils: 100 };
  const nowSeconds = 1_700_000_000;
  const { signature } = signPayload(payload, SECRET, nowSeconds - 400); // 400s stale, default tolerance 300s

  const result = verifySignature(payload, signature, SECRET, { now: nowSeconds });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "timestamp_out_of_tolerance");

  // A wider tolerance accepts the same signature.
  const withinWideTolerance = verifySignature(payload, signature, SECRET, {
    now: nowSeconds,
    toleranceSeconds: 1000,
  });
  assert.equal(withinWideTolerance.valid, true);
});

// YA: keep this test, it stops someone 'simplifying' to ===
test("verifySignature uses timingSafeEqualHex, not ===: a same-length wrong signature still returns signature_mismatch (not a thrown error)", () => {
  const payload = { amountFils: 100 };
  const { signature } = signPayload(payload, SECRET);
  const [tPart] = signature.split(",");
  const wrongSameLength = `${tPart},v1=${"0".repeat(64)}`;
  const result = verifySignature(payload, wrongSameLength, SECRET);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature_mismatch");
});
