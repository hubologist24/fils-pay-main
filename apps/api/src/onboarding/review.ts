import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../db/withTransaction.js";

export interface RecordKycReviewInput {
  merchantId: string;
  outcome: "approved" | "rejected";
  /** Display/back-compat identifier — an admin's email when the review came
   *  through the admin plane, 'seed' for seed fixtures. */
  reviewerIdentifier: string;
  /** The real FK, populated whenever the review came from an authenticated
   *  admin (0036). Null for pre-admin-plane rows such as seed fixtures. */
  reviewerAdminUserId?: string | null;
  notes?: string;
}

export interface RecordKycReviewResult {
  onboardingStatus: string;
  kycPassed: boolean;
}

/**
 * The one function permitted to write `merchants.kyc_passed` or set
 * `onboarding_status` to `'approved'`/`'rejected'`. Inserts a
 * `merchant_kyc_reviews` row and updates `merchants` in the same
 * transaction, deriving the merchant-row values directly from the row it
 * just inserted, so the two columns can never disagree.
 *
 * Takes an already-open transaction's client so a caller can compose it
 * with further writes that must succeed or fail with it — specifically the
 * admin route's `insertAdminAuditLog` call, which is the whole point: the
 * review and its audit record either both happen or neither does.
 */
// YA: single-merchant review writes merchant_kyc_reviews. bulk should reuse this
// MK: bulk writes the review trail too (kyc_bulk_approve audit row)
export async function recordKycReviewInTx(
  client: PoolClient,
  input: RecordKycReviewInput,
): Promise<RecordKycReviewResult> {
  await client.query(
    `INSERT INTO merchant_kyc_reviews (merchant_id, outcome, reviewer_identifier, reviewer_admin_user_id, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.merchantId,
      input.outcome,
      input.reviewerIdentifier,
      input.reviewerAdminUserId ?? null,
      input.notes ?? null,
    ],
  );

  const kycPassed = input.outcome === "approved";
  await client.query(
    `UPDATE merchants SET onboarding_status = $2, kyc_passed = $3 WHERE id = $1`,
    [input.merchantId, input.outcome, kycPassed],
  );

  return { onboardingStatus: input.outcome, kycPassed };
}

/**
 * Pool-based wrapper for callers with nothing to co-transact (the seed
 * generator, tests). Identical semantics to the in-transaction form — it
 * just opens the transaction itself.
 */
export async function recordKycReview(
  pool: Pool,
  input: RecordKycReviewInput,
): Promise<RecordKycReviewResult> {
  return withTransaction(pool, async (client) => recordKycReviewInTx(client, input));
}
