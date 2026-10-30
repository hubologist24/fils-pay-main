-- A cache of each merchant's payable balance, maintained incrementally by
-- apps/settlement at batch close/payout time, so a balance read doesn't
-- have to sum every ledger_entries row for the merchant.
CREATE TABLE merchant_balances (
    merchant_id               UUID PRIMARY KEY REFERENCES merchants (id),
    cached_payable_fils       BIGINT NOT NULL DEFAULT 0,
    last_settlement_batch_id  UUID REFERENCES settlement_batches (id),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
