import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { decryptSecret, encryptSecret } from "./secretCrypto.js";

const KEY = randomBytes(32);
const OTHER_KEY = randomBytes(32);

test("encryptSecret/decryptSecret round-trips the exact plaintext", () => {
  const ciphertext = encryptSecret("whsec_abc123", KEY);
  assert.notEqual(ciphertext, "whsec_abc123");
  assert.equal(decryptSecret(ciphertext, KEY), "whsec_abc123");
});

test("encryptSecret produces a different ciphertext each call (random IV)", () => {
  const a = encryptSecret("whsec_same", KEY);
  const b = encryptSecret("whsec_same", KEY);
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a, KEY), "whsec_same");
  assert.equal(decryptSecret(b, KEY), "whsec_same");
});

test("decryptSecret throws with the wrong key (auth tag fails to verify)", () => {
  const ciphertext = encryptSecret("whsec_abc123", KEY);
  assert.throws(() => decryptSecret(ciphertext, OTHER_KEY));
});

// passes — am
test("decryptSecret throws on tampered ciphertext", () => {
  const ciphertext = encryptSecret("whsec_abc123", KEY);
  const buf = Buffer.from(ciphertext, "base64");
  buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff; // flip the last byte
  const tampered = buf.toString("base64");
  assert.throws(() => decryptSecret(tampered, KEY));
});

test("encryptSecret/decryptSecret reject non-32-byte keys", () => {
  assert.throws(() => encryptSecret("whsec_x", randomBytes(16)));
  assert.throws(() => decryptSecret("anything", randomBytes(16)));
});
