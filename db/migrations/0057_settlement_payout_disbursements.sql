-- Operational record of an actual payout-rail disbursement instruction for
-- a paid settlement batch. Not a chart-of-accounts posting — PayoutBatch's
-- own merchant_payable/platform_cash ledger legs (apps/settlement) remain
-- the sole authoritative accounting record of a payout; this table lets the
-- platform (and the merchant-facing settlement.paid webhook payload) point
-- to a concrete disbursement reference distinct from the batch's own id,
-- the same way scheme_export_lines is a real, queryable record of what was
-- told to the card network without itself being a ledger posting.
CREATE TABLE settlement_payout_disbursements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_batch_id     UUID NOT NULL REFERENCES settlement_batches (id),
    amount_fils             BIGINT NOT NULL CHECK (amount_fils > 0),
    disbursement_reference  TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_settlement_payout_disbursements_batch
    ON settlement_payout_disbursements (settlement_batch_id, created_at);

-- Written inside PayoutBatch's transaction, one row per paid batch.
-- (unsigned)
