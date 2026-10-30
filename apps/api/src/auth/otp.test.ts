import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./otp.js";

test("generateOtpCode produces a zero-padded numeric string of the requested length", () => {
  for (let i = 0; i < 50; i++) {
    const code = generateOtpCode(6);
    assert.equal(code.length, 6);
    assert.match(code, /^\d{6}$/);
  }
});

test("generateOtpCode respects a different requested length", () => {
  const code = generateOtpCode(4);
  assert.equal(code.length, 4);
  assert.match(code, /^\d{4}$/);
});

test("generateOtpCode is not constant (statistical sanity)", () => {
  const codes = new Set(Array.from({ length: 25 }, () => generateOtpCode(6)));
  assert.ok(codes.size > 1);
});

test("hashOtpCode is deterministic for the same salt/code and differs per salt", () => {
  const a = hashOtpCode("123456", "salt-a");
  const b = hashOtpCode("123456", "salt-a");
  const c = hashOtpCode("123456", "salt-b");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("verifyOtpCode matches only the correct code for a given salt/hash", () => {
  const salt = "abc123def456";
  const hash = hashOtpCode("042817", salt);
  assert.equal(verifyOtpCode("042817", salt, hash), true);
  assert.equal(verifyOtpCode("000000", salt, hash), false);
  assert.equal(verifyOtpCode("042817", "different-salt", hash), false);
});
