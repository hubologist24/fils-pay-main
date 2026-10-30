-- Defensive schema-level backstop matching this table's existing 2dp
-- CHECK: a given transaction can appear at most once per batch's scheme
-- export. CloseBatch already guarantees this by construction (one row per
-- distinct transaction_id per batch, written once, inside one transaction)
-- — this constraint makes a violation impossible rather than merely
-- unlikely, the same posture 0007's balance trigger and 0019's
-- idempotency_keys UNIQUE already take elsewhere in this schema.
ALTER TABLE scheme_export_lines
    ADD CONSTRAINT scheme_export_lines_batch_txn_unique
    UNIQUE (settlement_batch_id, transaction_id);

-- FH: possible double export when a batch is re-run? the unique index should
-- prevent it but I saw two lines for one txn once on staging-2. FP-198?
