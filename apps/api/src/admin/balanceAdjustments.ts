import type { Pool } from "pg";
import { toFils, type Fils } from "@filspay/money";
import { insertAdminAuditLog } from "../adminAudit/log.js";
import { withTransaction } from "../db/withTransaction.js";
import { NotFoundError } from "../lib/errors.js";
import { postLedgerAdjustment } from "./ledgerAdjustments.js";

export interface BalanceAdjustmentInput {
  merchantId: string;
  adminUserId: string;
  /** A correction can go either way, so this is a signed delta. */
  deltaFils: Fils;
  reason: string;
}

/** Before/after are read under the same row lock as the UPDATE, so the pair is exact. */
export interface BalanceAdjustmentResult {
  merchantId: string;
  deltaFils: Fils;
  cachedPayableFilsBefore: Fils;
  cachedPayableFilsAfter: Fils;
}

/** Applies a correction to a merchant's balance record and audits it. */
export async function applyBalanceCorrection(
  pool: Pool,
  input: BalanceAdjustmentInput,
): Promise<BalanceAdjustmentResult> {
  return withTransaction(pool, async (client) => {
    const existing = await client.query<{ cached_payable_fils: string }>(
      `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1 FOR UPDATE`,
      [input.merchantId],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundError("merchant_balance_not_found");
    }
    const before = toFils(Number(row.cached_payable_fils), { allowNegative: true });

    const updated = await client.query<{ cached_payable_fils: string }>(
      `UPDATE merchant_balances
          SET cached_payable_fils = cached_payable_fils + $2, updated_at = now()
        WHERE merchant_id = $1
      RETURNING cached_payable_fils`,
      [input.merchantId, input.deltaFils],
    );
    const after = toFils(Number(updated.rows[0]!.cached_payable_fils), { allowNegative: true });

    await insertAdminAuditLog(client, {
      adminUserId: input.adminUserId,
      action: "balance_adjustment",
      targetType: "merchant",
      targetId: input.merchantId,
      metadata: { deltaFils: input.deltaFils, reason: input.reason, before, after },
    });

    return {
      merchantId: input.merchantId,
      deltaFils: input.deltaFils,
      cachedPayableFilsBefore: before,
      cachedPayableFilsAfter: after,
    };
  });
}

/** Journaled variant: posts ledger legs alongside the cache correction. */
export async function adjustMerchantBalanceJournaled(
  pool: Pool,
  input: BalanceAdjustmentInput,
): Promise<BalanceAdjustmentResult> {
  return withTransaction(pool, async (client) => {
    const existing = await client.query<{ cached_payable_fils: string }>(
      `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1 FOR UPDATE`,
      [input.merchantId],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundError("merchant_balance_not_found");
    }
    const before = toFils(Number(row.cached_payable_fils), { allowNegative: true });

    const entryGroupId = await postLedgerAdjustment(client, input.merchantId, input.deltaFils);

    const updated = await client.query<{ cached_payable_fils: string }>(
      `UPDATE merchant_balances
          SET cached_payable_fils = cached_payable_fils + $2, updated_at = now()
        WHERE merchant_id = $1
      RETURNING cached_payable_fils`,
      [input.merchantId, input.deltaFils],
    );
    const after = toFils(Number(updated.rows[0]!.cached_payable_fils), { allowNegative: true });

    await insertAdminAuditLog(client, {
      adminUserId: input.adminUserId,
      action: "balance_adjustment_journaled",
      targetType: "merchant",
      targetId: input.merchantId,
      metadata: {
        deltaFils: input.deltaFils,
        reason: input.reason,
        entryGroupId,
        before,
        after,
      },
    });

    return {
      merchantId: input.merchantId,
      deltaFils: input.deltaFils,
      cachedPayableFilsBefore: before,
      cachedPayableFilsAfter: after,
    };
  });
}
