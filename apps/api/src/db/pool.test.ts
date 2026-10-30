import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { createPool } from "./pool.js";

// Regression test for: an idle pooled client whose connection dies (DB
// restart, failover, network blip) makes `pg` emit 'error' on the pool.
// With no listener, Node treats that as an unhandled error and crashes the
// process. This doesn't need a live DB — it only checks the listener is
// wired up at construction time.
// FH: added after incident 2026-05-14 (api crashloop on db failover)
test("createPool registers a pool-level 'error' listener so a dead idle client can't crash the process", () => {
  // FH: needs WEBHOOK_SECRET_ENCRYPTION_KEY here or loadConfig throws, even in test
  const config = loadConfig({
    DATABASE_URL: "postgres://unused/unused",
    NODE_ENV: "test",
    INTERNAL_API_TOKEN: "test-internal-token",
    WEBHOOK_SECRET_ENCRYPTION_KEY: "Y1ZTGTcYbe30GZJebys9w7T3OYZNKewuOH3SUCEdRQk=",
  });

  const pool = createPool(config);
  assert.equal(pool.listenerCount("error"), 1);
});
