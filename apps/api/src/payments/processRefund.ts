import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { ZERO_FILS, addFils, calculateRefundFee, compareFils, subtractFils, toFils, type Fils } from "@filspay/money";
import { enqueueEvent } from "@filspay/events";
import { withTransaction } from "../db/withTransaction.js";
import type { AcquirerSimulator } from "../acquirer/types.js";
import { claimIdempotencyKey, completeIdempotencyKey, failIdempotencyKey, hashRequest } from "./idempotency.js";
import { recordTransactionEvent } from "../transactions/events.js";
import { nextStatusAfterRefund } from "./refundState.js";
import { validateRefundRequest } from "./refundValidation.js";
import { ConflictError, UnprocessableEntityError } from "../lib/errors.js";

const ENDPOINT = "refunds.create";

export interface ProcessRefundInput {
  transactionId: string;
  merchantId: string;
  amountFils?: Fils;
  idempotencyKey: string;
  actor: { type: "merchant_session" | "merchant_api_key"; id: string };
  reason?: string;
}

export interface ProcessRefundResult {
  statusCode: number;
  body: unknown;
}

interface RefundTransactionRow {
  id: string;
  merchant_id: string;
  status: string;
  amount_fils: string | number;
  captured_fils: string | number;
  refunded_fils: string | number;
  acquirer_reference: string;
}

/** Refund business logic: validate, call the acquirer, then journal the reversal. */
export async function processRefund(
  pool: Pool,
  acquirer: AcquirerSimulator,
  input: ProcessRefundInput,
): Promise<ProcessRefundResult> {
  const requestHash = hashRequest({
    transactionId: input.transactionId,
    amountFils: input.amountFils ?? null,
    reason: input.reason ?? null,
  });

  // 1 validate
  const prepared = await withTransaction(pool, async (client) => {
    const claim = await claimIdempotencyKey(client, {
      merchantId: input.merchantId,
      endpoint: ENDPOINT,
      key: input.idempotencyKey,
      requestHash,
    });

    if (claim.outcome === "conflict_hash_mismatch") {
      throw new UnprocessableEntityError("idempotency_key_reused");
    }
    if (claim.outcome === "conflict_in_progress") {
      throw new ConflictError("request_in_progress");
    }
    if (claim.outcome === "replay") {
      return {
        kind: "settled" as const,
        result: { statusCode: claim.row.responseStatusCode ?? 200, body: claim.row.responseBody },
      };
    }

    //Hatice added for update
    const txnResult = await client.query<RefundTransactionRow>(
      `SELECT id, merchant_id, status, amount_fils, captured_fils, refunded_fils, acquirer_reference
         FROM transactions
        WHERE id = $1
        FOR UPDATE`,
      [input.transactionId],
    );
    const txn = txnResult.rows[0];
    if (!txn) {
      const body = { error: "transaction_not_found" };
      await completeIdempotencyKey(client, claim.row.id, { statusCode: 404, body });
      return { kind: "settled" as const, result: { statusCode: 404, body } };
    }

    const amountAuthorized = toFils(Number(txn.amount_fils));
    const capturedFils = toFils(Number(txn.captured_fils));
    const refundedFils = toFils(Number(txn.refunded_fils));

    //const refundableFils = subtractFils(amountAuthorized, refundedFils);
    const refundableFils = subtractFils(capturedFils, refundedFils);
    //Hatice  money actually captured and not yet returned

    const validation = validateRefundRequest(
      {
        id: txn.id,
        merchantId: txn.merchant_id,
        status: txn.status,
        capturedFils,
        refundableFils,
      },
      input.amountFils,
    );

    if (!validation.ok) {
      const statusCode = validation.code === "transaction_not_refundable" ? 409 : 422;
      await completeIdempotencyKey(client, claim.row.id, { statusCode, body: validation });
      return { kind: "settled" as const, result: { statusCode, body: validation } };
    }

    // The fee this transaction was actually charged at capture, read from
    // the ledger rather than recomputed from the merchant's current
    // mdr_bps, so a rate change after capture can never retroactively alter
    // what a refund reverses.
    const feeResult = await client.query<{ fee_fils: string }>(
      `SELECT COALESCE(SUM(amount_fils), 0)::text AS fee_fils
         FROM ledger_entries
        WHERE transaction_id = $1
          AND account_id = 'platform_fee_revenue'
          AND direction = 'credit'`,
      [txn.id],
    );
    const feeRow = feeResult.rows[0];
    if (!feeRow) {
      throw new Error("processRefund: fee aggregate returned no row");
    }

    return {
      kind: "proceed" as const,
      claimId: claim.row.id,
      attemptCount: claim.row.attemptCount,
      transactionId: txn.id,
      merchantId: txn.merchant_id,
      acquirerReference: txn.acquirer_reference,
      amountAuthorized,
      capturedFils,
      refundedFils,
      feeChargedFils: toFils(Number(feeRow.fee_fils)),
      requestedAmount: validation.amountFils,
    };
  });

  if (prepared.kind === "settled") {
    return prepared.result;
  }

  // 2 acquirer
  const acquirerResult = await acquirer.refund({
    acquirerReference: prepared.acquirerReference,
    amountFils: prepared.requestedAmount,
    idempotencyKey: `${prepared.claimId}:${prepared.attemptCount}`,
  });

  // 3 journal (with atomic guard update to prevent concurrent double refunds)
  return withTransaction(pool, async (client) => {
    if (acquirerResult.outcome === "declined") {
      const body = { error: "refund_declined" };
      await completeIdempotencyKey(client, prepared.claimId, { statusCode: 402, body });
      return { statusCode: 402, body };
    }
    if (acquirerResult.outcome === "error") {
      const body = { error: "acquirer_unavailable" };
      await failIdempotencyKey(client, prepared.claimId, { statusCode: 502, body });
      return { statusCode: 502, body };
    }

    // Fetch latest captured_fils to compute status and fees correctly after locking
    const txnResult = await client.query<RefundTransactionRow>(
      `SELECT captured_fils FROM transactions WHERE id = $1 FOR UPDATE`,
      [prepared.transactionId],
    );
    const txn = txnResult.rows[0];
    if (!txn) {
      throw new Error("processRefund: transaction disappeared during acquirer call");
    }
    const capturedFils = toFils(Number(txn.captured_fils));

    //Hatice modified this like that: atomic update guard ensuring no concurrent over-refund happens
    const updateResult = await client.query(
      `UPDATE transactions 
          SET refunded_fils = refunded_fils + $2, 
              status = CASE 
                WHEN refunded_fils + $2 >= captured_fils THEN 'refunded' 
                ELSE 'partially_refunded' 
              END
        WHERE id = $1 AND refunded_fils + $2 <= captured_fils`,
      [prepared.transactionId, prepared.requestedAmount],
    );

    if (updateResult.rowCount === 0) {
      const body = { error: "concurrent_refund_limit_exceeded" };
      await completeIdempotencyKey(client, prepared.claimId, { statusCode: 409, body });
      return { statusCode: 409, body };
    }

    // Fetch the updated total refunded fils for downstream calculations & events
    const refreshedTxn = await client.query<{ refunded_fils: string | number, status: string }>(
      `SELECT refunded_fils, status FROM transactions WHERE id = $1`,
      [prepared.transactionId],
    );
    const newRefundedTotal = toFils(Number(refreshedTxn.rows[0]!.refunded_fils));
    const newStatus = refreshedTxn.rows[0]!.status;

  // hatice:
    //   what's wrong: calculateRefundFee is pure proportional — it rounds
    //     each refund's fee share independently, with no carry between
    //     refunds. Over an uneven split (3_333 + 3_333 + 3_334 of a 10_000
    //     capture with a 250-fil fee) the rounded shares sum to 249, not 250,
    //     so the merchant loses one fil of fee reversal on the last refund.
    //   why: bankersRoundDiv(250 * 3_333 / 10_000) = 83, taken three times,
    //     plus 83 for the last slice = 249. The fractional fil discarded on
    //     each partial refund is never carried forward.
    //   what it breaks: the final partial refund of a fully refunded capture
    //     leaves platform_fee_revenue over-credited by a fil (or
    //     under-credited on other splits), even though every individual
    //     ledger group still balances. The merchant's net payout drifts by a
    //     few fils, silently, and no other test catches it because no test
    //     accumulates the reversals.
    //   the fix: reverse the difference of two cumulative rounded shares,
    //     not one independent share. calculateRefundFee(newRefundedTotal) -
    //     calculateRefundFee(previousRefundedTotal) lands the final refund on
    //     exactly the full fee, regardless of how the refunds were split.
    //     previousRefundedTotal is derived as newRefundedTotal - requestedAmount
    //     because the pre-refund total (refundedFils) is scoped to the earlier
    //     validation transaction, not this one.
    const previousRefundedTotal = subtractFils(newRefundedTotal, prepared.requestedAmount);
    const feeReversedFils = subtractFils(
      calculateRefundFee(capturedFils, prepared.feeChargedFils, newRefundedTotal),
      calculateRefundFee(capturedFils, prepared.feeChargedFils, previousRefundedTotal),
    );

    const refundResult = await client.query<{ id: string; occurred_at: Date }>(
      `INSERT INTO refunds
         (transaction_id, merchant_id, amount_fils, fee_reversed_fils, status,
          acquirer_reference, reason, created_by_type, created_by_id)
       VALUES ($1, $2, $3, $4, 'succeeded', $5, $6, $7, $8)
       RETURNING id, occurred_at`,
      [
        prepared.transactionId,
        prepared.merchantId,
        prepared.requestedAmount,
        feeReversedFils,
        acquirerResult.acquirerReference,
        // hatice: the column has DEFAULT 'unspecified', but passing an
        // explicit NULL bypasses the default and violates
        // chk_refunds_reason_not_null (NOT VALID only exempts pre-existing
        // rows). Resolve the omission here so a missing reason lands on the
        // same 'unspecified' value the migration documents.
        input.reason ?? "unspecified",
        input.actor.type,
        input.actor.id,
      ],
    );
    const refund = refundResult.rows[0];
    if (!refund) {
      throw new Error("processRefund: insert into refunds returned no row");
    }

    // Double-entry reversal, mirroring capture's legs with the directions
    // swapped. ledger_entries has CHECK (amount_fils > 0), so a reversal
    // flips direction and never the sign.
    const entryGroupId = randomUUID();
    await client.query(
      `INSERT INTO ledger_entries
         (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
       VALUES
         ($1, $2, $3, 'merchant_payable',    'debit',  $4, now(), 'refund: gross'),
         ($1, $2, $3, 'card_scheme_clearing', 'credit', $4, now(), 'refund: gross')`,
      [entryGroupId, prepared.merchantId, prepared.transactionId, prepared.requestedAmount],
    );
    if (compareFils(feeReversedFils, ZERO_FILS) > 0) {
      await client.query(
        `INSERT INTO ledger_entries
           (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
         VALUES
           ($1, $2, $3, 'platform_fee_revenue', 'debit',  $4, now(), 'refund: MDR fee reversal'),
           ($1, $2, $3, 'merchant_payable',    'credit', $4, now(), 'refund: MDR fee reversal')`,
        [entryGroupId, prepared.merchantId, prepared.transactionId, feeReversedFils],
      );
    }

    // The timeline records what this refund did to the captured amount, so
    // it stays readable regardless of what the status column ends up
    // saying: everything captured has now gone back, or only part of it has.
    const eventType = compareFils(newRefundedTotal, capturedFils) >= 0 ? "refunded" : "refund_partial";

    await recordTransactionEvent(client, {
      transactionId: prepared.transactionId,
      eventType,
      amountFils: toFils(-prepared.requestedAmount, { allowNegative: true }),
      actor: input.actor,
      metadata: {
        refundId: refund.id,
        feeReversedFils,
        acquirerReference: acquirerResult.acquirerReference,
      },
    });

    await enqueueEvent(client, {
      eventType: "refund.succeeded",
      aggregateType: "transaction",
      aggregateId: prepared.transactionId,
      payload: {
        merchantId: prepared.merchantId,
        refundId: refund.id,
        //amountFils: prepared.requestedAmount,
        amountRefundedFils: prepared.requestedAmount, //Hatice Renamed from amountFils to amountRefundedFils
        feeReversedFils,
        refundedTotalFils: newRefundedTotal,
        newStatus,
      },
    });

    const body = {
      id: refund.id,
      transactionId: prepared.transactionId,
      merchantId: prepared.merchantId,
      amountFils: prepared.requestedAmount,
      feeReversedFils,
      status: "succeeded",
      transactionStatus: newStatus,
      refundedTotalFils: newRefundedTotal,
      acquirerReference: acquirerResult.acquirerReference,
      occurredAt: refund.occurred_at.toISOString(),
    };
    await completeIdempotencyKey(client, prepared.claimId, {
      statusCode: 200,
      body,
      resourceId: refund.id,
    });
    return { statusCode: 200, body };
  });
}