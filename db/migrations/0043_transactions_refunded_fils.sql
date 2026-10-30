-- The running refunded total on the transaction row, mirroring captured_fils.
-- CHECK is >= 0 only — the refundable ceiling depends on more inputs than
-- this row holds, so it is enforced in the application layer.

ALTER TABLE transactions
    ADD COLUMN refunded_fils BIGINT NOT NULL DEFAULT 0
        CHECK (refunded_fils >= 0);

-- Widen the status vocabulary for partial refunds. 'refunded' was already
-- listed in 0004; 'partially_refunded' is the state between the first
-- partial refund and the last one.
ALTER TABLE transactions DROP CONSTRAINT transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('authorized', 'captured', 'partially_captured',
                      'voided', 'partially_refunded', 'refunded', 'chargeback'));

