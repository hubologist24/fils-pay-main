-- The "payout trends" analytics rollup: a denormalized copy of
-- settlement_batches' figures, not a recomputation, filled from the
-- settlement.batch_closed outbox event. It exists so all three dashboard
-- widgets share one response shape with a visible readModelAsOf.
-- /v1/settlement/batches stays the authoritative, live report (batch
-- detail, included transactions, reconciliation); this is the chart.
--
-- status/paid_at are captured when the batch_closed event is applied and
-- are not re-synced when the batch later goes closed -> paid (there's no
-- "batch paid" event). Fine for a trend chart; don't read money from here.

CREATE TABLE merchant_payout_trends (
    merchant_id          UUID NOT NULL REFERENCES merchants (id),
    settlement_batch_id  UUID NOT NULL REFERENCES settlement_batches (id),
    batch_date           DATE NOT NULL,
    status                TEXT NOT NULL,
    gross_fils             BIGINT NOT NULL,
    fee_fils                BIGINT NOT NULL,
    net_payout_fils          BIGINT NOT NULL,
    paid_at                   TIMESTAMPTZ,
    last_updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (merchant_id, settlement_batch_id)
);

-- Backs GET /v1/analytics/payout-trends's range scan.
CREATE INDEX idx_merchant_payout_trends_merchant_date
    ON merchant_payout_trends (merchant_id, batch_date);
