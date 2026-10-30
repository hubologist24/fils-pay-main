import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { hashPassword, verifyPassword } from "./passwords.js";

// hashPassword only parses config fields, never connects to the database,
// so a syntactically valid but unreachable DATABASE_URL is fine here.
const config = loadConfig({
  DATABASE_URL: "postgres://unused/unused",
  NODE_ENV: "test",
  WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
});

test("hashPassword / verifyPassword round-trip", async () => {
  const hash = await hashPassword("correct horse battery staple", config);
  assert.ok(hash.startsWith("$argon2id$"));
  assert.equal(await verifyPassword(hash, "correct horse battery staple"), true);
  assert.equal(await verifyPassword(hash, "wrong password"), false);
});

test("verifyPassword returns false (never throws) on a malformed hash", async () => {
  assert.equal(await verifyPassword("not-a-real-argon2-hash", "anything"), false);
});

// FH: slow (~400ms) because argon2, fine
test("hashPassword salts each call independently", async () => {
  const a = await hashPassword("same-password", config);
  const b = await hashPassword("same-password", config);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(a, "same-password"), true);
  assert.equal(await verifyPassword(b, "same-password"), true);
});
