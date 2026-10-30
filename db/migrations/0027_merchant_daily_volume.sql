-- The "volumes" analytics rollup: one row per (merchant, Asia/Bahrain
-- calendar date), maintained incrementally by apps/reporting's consumer
-- as transaction.captured/transaction.voided outbox
-- events are applied. volume_date is bucketed the same way settlement
-- buckets a business day (Asia/Bahrain local calendar date, a fixed
-- UTC+3 offset with no DST) so a merchant's dashboard and their
-- settlement batches agree on what "a day" means, even though this table
-- has no other relationship to settlement_batches.
--
-- captured_gross_fils sums the exact per-event amount_fils delta
-- capture.ts already recorded (the outbox payload's amountCapturedFils) —
-- never a second aggregation over transactions.captured_fils (a running
-- total), which summed alongside per-event deltas would double-count.
-- voided_count has no corresponding *_gross_fils column: void.ts's outbox
-- payload carries only { merchantId } (no amount), so there is nothing to
-- sum for a voided transaction here.

CREATE TABLE merchant_daily_volume (
    merchant_id          UUID NOT NULL REFERENCES merchants (id),
    volume_date          DATE NOT NULL,
    captured_count        INTEGER NOT NULL DEFAULT 0,
    captured_gross_fils   BIGINT NOT NULL DEFAULT 0,
    voided_count           INTEGER NOT NULL DEFAULT 0,
    last_updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (merchant_id, volume_date)
);

-- Backs GET /v1/analytics/volumes's range scan.
CREATE INDEX idx_merchant_daily_volume_merchant_date
    ON merchant_daily_volume (merchant_id, volume_date);
