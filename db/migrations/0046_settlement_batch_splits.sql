-- Records, for one parent merchant's settlement batch, exactly how much
-- each child was allocated. This is the durable audit trail of a split
-- payout — the same role scheme_export_lines plays for a batch's
-- per-transaction card-network export: a real row exists the moment the
-- payout happens, independent of whether anyone ever asks for a report
-- about it.
CREATE TABLE settlement_batch_splits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_batch_id UUID NOT NULL REFERENCES settlement_batches (id),
    child_merchant_id   UUID NOT NULL REFERENCES merchants (id),
    split_weight_bps    INTEGER NOT NULL,
    allocated_fils      BIGINT NOT NULL CHECK (allocated_fils >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (settlement_batch_id, child_merchant_id)
);

CREATE INDEX idx_settlement_batch_splits_batch ON settlement_batch_splits (settlement_batch_id);
