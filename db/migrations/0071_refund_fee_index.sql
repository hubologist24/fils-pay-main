-- Partial index for the refund fee-reversal lookup the settlement
-- recomputation path hits: only rows that actually reversed a fee.

CREATE INDEX idx_refunds_fee_reversal
    ON refunds (transaction_id, fee_reversed_fils)
    WHERE fee_reversed_fils > 0;
