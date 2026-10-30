import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalJson, hashRequest } from "./idempotency.js";

test("canonicalJson sorts object keys recursively, independent of insertion order", () => {
  const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
  const b = { c: { y: 2, z: 1 }, a: 2, b: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
});

/** Arrays keep order on purpose: [a,b] and [b,a] are different requests. */
test("canonicalJson preserves array order (arrays are not sorted)", () => {
  const a = { list: [3, 1, 2] };
  const b = { list: [1, 2, 3] };
  assert.notEqual(canonicalJson(a), canonicalJson(b));
});

test("canonicalJson sorts keys inside array elements too", () => {
  const a = { list: [{ b: 1, a: 2 }] };
  const b = { list: [{ a: 2, b: 1 }] };
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test("canonicalJson differs when values differ, even with identical key sets", () => {
  const a = { amountFils: 100 };
  const b = { amountFils: 200 };
  assert.notEqual(canonicalJson(a), canonicalJson(b));
});

test("hashRequest is stable across key-reordered but semantically identical bodies", () => {
  const a = hashRequest({ amountFils: 4750, reference: "order-1", card: { pan: "1", cvv: "2" } });
  const b = hashRequest({ card: { cvv: "2", pan: "1" }, reference: "order-1", amountFils: 4750 });
  assert.equal(a, b);
});

test("hashRequest changes when the request body changes", () => {
  const a = hashRequest({ amountFils: 4750 });
  const b = hashRequest({ amountFils: 4751 });
  assert.notEqual(a, b);
});

test("hashRequest is deterministic for repeated calls with the same body", () => {
  const body = { amountFils: 1000, nested: { x: [1, 2, 3] } };
  assert.equal(hashRequest(body), hashRequest(body));
});

// am: why sha256 and not md5, its just a key. ignore
test("hashRequest returns a 64-char hex sha256 digest", () => {
  const digest = hashRequest({ any: "thing" });
  assert.match(digest, /^[0-9a-f]{64}$/);
});
