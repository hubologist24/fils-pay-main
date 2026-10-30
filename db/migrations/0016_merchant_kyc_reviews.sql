-- This table is the single source of truth for KYC approval.
-- merchants.kyc_passed and merchants.onboarding_status are only ever
-- written by the one function/transaction that inserts a row here and
-- updates merchants in the same transaction, deriving the merchant-row
-- values directly from the row it just inserted. No other code path should
-- ever `UPDATE merchants SET kyc_passed = ...` directly.
--
-- reviewer_identifier is a plain string (an internal operator's email)
-- because there's no staff-user table yet. Widen it to a real FK once the
-- admin console has its own accounts.

CREATE TABLE merchant_kyc_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants (id),
    outcome             TEXT NOT NULL CHECK (outcome IN ('approved', 'rejected')),
    reviewer_identifier TEXT NOT NULL,
    notes               TEXT,
    reviewed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchant_kyc_reviews_merchant
    ON merchant_kyc_reviews (merchant_id, reviewed_at DESC);

-- AM: bulk approve (admin/bulkKyc.ts) goes through the same review function,
-- one row per merchant. checked with FH. (Jul)
