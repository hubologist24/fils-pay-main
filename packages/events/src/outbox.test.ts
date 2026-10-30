import assert from "node:assert/strict";
import { test } from "node:test";
import { enqueueEvent, type QueryableClient } from "./outbox.js";

/** A fake transactional client that records every call it receives and
 *  simulates the RETURNING row a real Postgres insert would hand back. */
function createFakeClient() {
  const calls: Array<{ text: string; params: unknown[] | undefined }> = [];
  let nextId = 1;

  const client: QueryableClient = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      const [eventType, aggregateType, aggregateId, payloadJson] = params ?? [];
      return {
        rows: [
          {
            id: String(nextId++),
            event_type: eventType,
            aggregate_type: aggregateType,
            aggregate_id: aggregateId,
            payload: JSON.parse(payloadJson as string),
            created_at: new Date("2026-01-01T00:00:00Z"),
            processed_at: null,
          },
        ],
      };
    },
  };

  return { client, calls };
}

test("enqueueEvent inserts inside the caller's own client (no side-channel connection)", async () => {
  const { client, calls } = createFakeClient();

  const row = await enqueueEvent(client, {
    eventType: "transaction.captured",
    aggregateType: "transaction",
    aggregateId: "11111111-1111-4111-8111-111111111111",
    payload: { amountFils: 4750 },
  });

  assert.equal(calls.length, 1, "enqueueEvent must issue exactly one query against the passed client");
  assert.match(calls[0]?.text ?? "", /INSERT INTO outbox_events/);

  assert.equal(row.id, 1n);
  assert.equal(row.eventType, "transaction.captured");
  assert.equal(row.aggregateType, "transaction");
  assert.equal(row.aggregateId, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(row.payload, { amountFils: 4750 });
  assert.ok(row.createdAt instanceof Date);
  assert.equal(row.processedAt, null);
});

// FH: copilot wrote these 4, all mock-based. no real pg
test("enqueueEvent serializes the payload as JSON rather than relying on driver magic", async () => {
  const { client, calls } = createFakeClient();

  await enqueueEvent(client, {
    eventType: "settlement.batch_closed",
    aggregateType: "settlement_batch",
    aggregateId: "22222222-2222-4222-8222-222222222222",
    payload: { grossFils: 100_000, feeFils: 2_500, netPayoutFils: 97_500 },
  });

  const params = calls[0]?.params ?? [];
  assert.equal(typeof params[3], "string");
  assert.deepEqual(JSON.parse(params[3] as string), {
    grossFils: 100_000,
    feeFils: 2_500,
    netPayoutFils: 97_500,
  });
});

test("enqueueEvent throws if the query result has no rows", async () => {
  const client: QueryableClient = {
    async query() {
      return { rows: [] };
    },
  };

  await assert.rejects(
    () =>
      enqueueEvent(client, {
        eventType: "transaction.voided",
        aggregateType: "transaction",
        aggregateId: "33333333-3333-4333-8333-333333333333",
        payload: {},
      }),
    /returned no row/,
  );
});

test("enqueueEvent throws if the query result has an unexpected shape", async () => {
  const client: QueryableClient = {
    async query() {
      return "not a result object";
    },
  };

  await assert.rejects(
    () =>
      enqueueEvent(client, {
        eventType: "transaction.voided",
        aggregateType: "transaction",
        aggregateId: "44444444-4444-4444-8444-444444444444",
        payload: {},
      }),
    /expected shape/,
  );
});
