//Hatice he standard Idempotency-Key header, body fallback, UUID 

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { toFils } from "@filspay/money";
import { requireMerchantAuth, requireMerchantWriterActor } from "../auth/requireMerchantAuth.js";
import { initiateMerchantRefund } from "../refunds/initiateMerchantRefund.js";
import { BadRequestError } from "../lib/errors.js";

export async function refundRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { preHandler: requireMerchantAuth }, async (request, reply) => {
    const auth = request.merchantAuth!;
    const body = (request.body ?? {}) as Record<string, unknown>;

    if (typeof body.transactionId !== "string" || body.transactionId === "") {
      throw new BadRequestError("invalid_request", "transactionId is required");
    }

    let amountFils;
    if (body.amountFils !== undefined && body.amountFils !== null) {
      if (typeof body.amountFils !== "number" || !Number.isSafeInteger(body.amountFils) || body.amountFils <= 0) {
        throw new BadRequestError("invalid_amount", "amountFils must be a positive integer number of fils");
      }
      amountFils = toFils(body.amountFils);
    }

    const headerKey = request.headers["idempotency-key"];
    const idempotencyKey =
      (typeof headerKey === "string" && headerKey) ||
      (typeof body.idempotencyKey === "string" && body.idempotencyKey) 
      //Hatice || randomUUID()   removed random fallback also throw prevent double refund
      ;
      if (!idempotencyKey) {
      throw new BadRequestError("idempotency_key_required", "Idempotency-Key header is required");
    }

    const result = await initiateMerchantRefund(app.db, app.acquirer, {
      merchantId: auth.merchantId,          // scope from auth only
      transactionId: body.transactionId,
      amountFils,
      idempotencyKey,
      actor: requireMerchantWriterActor(auth),
      reason: typeof body.reason === "string" ? body.reason : undefined,
    });

    reply.code(result.statusCode).send(result.body);
  });
}