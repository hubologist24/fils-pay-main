-- Persists the acquirer's own reference from the original authorize()
-- call. capture() and refund() both have to hand it back to the acquirer,
-- and 0004 predates the acquirer integration.
--
-- Same caveat as 0010: ADD COLUMN ... NOT NULL with no default fails against
-- a transactions table that already has rows. Re-create a stale local DB
-- (or truncate transactions) before migrating.

ALTER TABLE transactions
    ADD COLUMN acquirer_reference TEXT NOT NULL;

CREATE INDEX idx_transactions_acquirer_reference ON transactions (acquirer_reference);

-- Backs GET /v1/transactions's keyset pagination
-- (apps/api/src/transactions/query.ts). Same shape as
-- idx_ledger_entries_merchant_occurred.
CREATE INDEX idx_transactions_merchant_occurred ON transactions (merchant_id, occurred_at DESC, id DESC);
