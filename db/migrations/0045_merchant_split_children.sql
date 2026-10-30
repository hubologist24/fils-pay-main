-- Models a parent merchant that distributes its settlement proceeds across
-- one or more child (sub-)merchant accounts — a marketplace/franchise
-- payout split. A "parent" is simply any merchant referenced as
-- parent_merchant_id here; a merchant with no rows pointing to it as a
-- parent settles exactly as every merchant does today, unaffected.
CREATE TABLE merchant_split_children (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_merchant_id UUID NOT NULL REFERENCES merchants (id),
    child_merchant_id  UUID NOT NULL REFERENCES merchants (id),
    -- Share of the parent's net settlement payout this child receives,
    -- basis points (10000 = 100%). A parent's children are expected to sum
    -- to 10000 — enforced by whatever creates these rows (the seed, today;
    -- a future admin tool, eventually), not by a cross-row database
    -- constraint. Postgres CHECK constraints cannot reference other rows
    -- without a trigger, and this table has no other need for one yet.
    split_weight_bps   INTEGER NOT NULL CHECK (split_weight_bps > 0 AND split_weight_bps <= 10000),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_merchant_id, child_merchant_id),
    CHECK (parent_merchant_id <> child_merchant_id)
);

CREATE INDEX idx_merchant_split_children_parent ON merchant_split_children (parent_merchant_id);

-- FH: allocate.go doesn't check the weights sum to 10000 and splits each
-- child with ApplyRateFils, not allocateRemainder. filed FP-250 (Aug)
-- AM: FP-250 closed, the seed always writes 10000
