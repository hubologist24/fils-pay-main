-- Marks a capture-type transaction_events row as "already accounted for in
-- a settlement batch." NULL means "eligible to be picked up by the next
-- batching pass." Once set, it is never cleared and never reassigned — a
-- transaction_events row belongs to at most one batch, forever. This is
-- the exact mechanism that makes double-batching impossible: eligibility
-- is always `settlement_batch_id IS NULL`, and only one committed
-- transaction can ever flip a given row from NULL to non-NULL (CloseBatch
-- locks the rows it claims).
ALTER TABLE transaction_events
    ADD COLUMN settlement_batch_id UUID REFERENCES settlement_batches (id);

-- Backs the batching pass's scan for eligible events across a business-day
-- window, independent of which merchant they belong to (the query itself
-- joins to transactions for the merchant_id predicate).
CREATE INDEX idx_transaction_events_unbatched
    ON transaction_events (occurred_at)
    WHERE settlement_batch_id IS NULL
      AND event_type IN ('captured', 'partially_captured');
