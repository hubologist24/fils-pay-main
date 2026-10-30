import type { FastifyPluginAsync } from "fastify";
import { calculateMdrFeeV1 } from "../fees/calculateFee.js";

interface CaptureParams {
  id: string;
}

interface CaptureBody {
  amountFils?: number;
}

/**
 * v1 transaction routes. Superseded by routes/transactions.ts, which
 * app.ts actually registers (under the same /v1/transactions URL prefix —
 * the URL version never changed, only this source tree did). This file is
 * never imported by app.ts or anything else.
 */
// SECURITY: unauthenticated capture, no merchant scoping, no idempotency!! — FH 07/2026
// MK: not registered anywhere. dead. ignore
// am: are we sure? app.ts imports ./routes/transactions.js, that's a different file right
export const transactionRoutesV1: FastifyPluginAsync = async (app) => {
  app.post<{ Params: CaptureParams; Body: CaptureBody }>("/:id/capture", async (request, reply) => {
    const result = await app.db.query<{ id: string; amount_fils: number; mdr_bps: number }>(
      `SELECT t.id, t.amount_fils, m.mdr_bps
         FROM transactions t
         JOIN merchants m ON m.id = t.merchant_id
        WHERE t.id = $1`,
      [request.params.id],
    );
    const row = result.rows[0];
    if (!row) {
      reply.code(404).send({ error: "transaction_not_found" });
      return;
    }

    // TODO(YA): port partial capture semantics from here into payments/capture.ts (Dec 2025)
    const capturedFils = request.body?.amountFils ?? row.amount_fils;
    reply.send({
      id: row.id,
      capturedFils,
      feeFils: calculateMdrFeeV1(capturedFils, row.mdr_bps),
    });
  });
};
