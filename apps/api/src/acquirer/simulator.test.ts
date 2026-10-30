import assert from "node:assert/strict";
import { test } from "node:test";
import { toFils } from "@filspay/money";
import { createAcquirerSimulator } from "./simulator.js";

const card = { pan: "4111111111111111", expiryMonth: 12, expiryYear: 2030, cvv: "123" };

test("authorize approves a non-magic PAN when failure rate is 0", async () => {
  const sim = createAcquirerSimulator({
    acquirerLatencyMinMs: 0,
    acquirerLatencyMaxMs: 1,
    acquirerFailureRate: 0,
    acquirerRngSeed: 1,
  });
  const result = await sim.authorize({
    merchantId: "m1",
    amountFils: toFils(1000),
    currency: "BHD",
    card,
    idempotencyKey: "idem-approve",
  });
  assert.equal(result.outcome, "approved");
  assert.equal(result.declineReason, undefined);
  assert.ok(result.acquirerReference.startsWith("acq_"));
});

test("magic PAN suffixes are deterministic regardless of the failure-rate roll", async () => {
  const sim = createAcquirerSimulator({
    acquirerLatencyMinMs: 0,
    acquirerLatencyMaxMs: 1,
    acquirerFailureRate: 0,
    acquirerRngSeed: 2,
  });

  const doNotHonor = await sim.authorize({
    merchantId: "m1",
    amountFils: toFils(1000),
    currency: "BHD",
    card: { ...card, pan: "4000000000000002" },
    idempotencyKey: "idem-0002",
  });
  assert.equal(doNotHonor.outcome, "declined");
  assert.equal(doNotHonor.declineReason, "do_not_honor");

  const insufficientFunds = await sim.authorize({
    merchantId: "m1",
    amountFils: toFils(1000),
    currency: "BHD",
    card: { ...card, pan: "4000000000000119" },
    idempotencyKey: "idem-0119",
  });
  assert.equal(insufficientFunds.outcome, "declined");
  assert.equal(insufficientFunds.declineReason, "insufficient_funds");

  const acquirerError = await sim.authorize({
    merchantId: "m1",
    amountFils: toFils(1000),
    currency: "BHD",
    card: { ...card, pan: "4000000000000069" },
    idempotencyKey: "idem-0069",
  });
  assert.equal(acquirerError.outcome, "error");
});

test("authorize idempotency cache returns the exact cached result for a repeated key, not a re-rolled one", async () => {
  const sim = createAcquirerSimulator({
    acquirerLatencyMinMs: 5,
    acquirerLatencyMaxMs: 50,
    acquirerFailureRate: 1, // force a non-approved roll every time it's actually rolled
    acquirerRngSeed: 3,
  });
  const req = {
    merchantId: "m1",
    amountFils: toFils(500),
    currency: "BHD" as const,
    card,
    idempotencyKey: "same-key-authorize",
  };
  const first = await sim.authorize(req);
  const second = await sim.authorize(req);
  const third = await sim.authorize(req);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("capture idempotency cache returns the exact cached result for a repeated key", async () => {
  const sim = createAcquirerSimulator({
    acquirerLatencyMinMs: 0,
    acquirerLatencyMaxMs: 1,
    acquirerFailureRate: 0.5,
    acquirerRngSeed: 4,
  });
  const req = { acquirerReference: "acq_fixed", amountFils: toFils(250), idempotencyKey: "same-key-capture" };
  const first = await sim.capture(req);
  const second = await sim.capture(req);
  assert.deepEqual(first, second);
});

test("different idempotency keys are not conflated with each other", async () => {
  const sim = createAcquirerSimulator({
    acquirerLatencyMinMs: 0,
    acquirerLatencyMaxMs: 1,
    acquirerFailureRate: 0,
    acquirerRngSeed: 5,
  });
  const a = await sim.authorize({
    merchantId: "m1",
    amountFils: toFils(100),
    currency: "BHD",
    card,
    idempotencyKey: "key-a",
  });
  const b = await sim.authorize({
    merchantId: "m1",
    amountFils: toFils(100),
    currency: "BHD",
    card,
    idempotencyKey: "key-b",
  });
  assert.notEqual(a.acquirerReference, b.acquirerReference);
});

// flaky once on my machine, couldnt repro — am
test("a seeded RNG produces reproducible outcome/latency sequences across separate instances", async () => {
  const makeSim = () =>
    createAcquirerSimulator({
      acquirerLatencyMinMs: 0,
      acquirerLatencyMaxMs: 100,
      acquirerFailureRate: 0.5,
      acquirerRngSeed: 777,
    });
  const simA = makeSim();
  const simB = makeSim();

  const strip = (r: { outcome: string; latencyMs: number; declineReason?: string }) => ({
    outcome: r.outcome,
    latencyMs: r.latencyMs,
    declineReason: r.declineReason,
  });

  for (let i = 0; i < 5; i++) {
    const resultA = await simA.authorize({
      merchantId: "m",
      amountFils: toFils(100),
      currency: "BHD",
      card,
      idempotencyKey: `k${i}`,
    });
    const resultB = await simB.authorize({
      merchantId: "m",
      amountFils: toFils(100),
      currency: "BHD",
      card,
      idempotencyKey: `k${i}`,
    });
    assert.deepEqual(strip(resultA), strip(resultB));
  }
});
