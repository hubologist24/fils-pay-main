-- Exactly the widening 0018_transaction_events.sql said would happen when
-- refunds arrived: a plain DROP CONSTRAINT ... ADD CONSTRAINT adding
-- 'refunded' and 'refund_partial' to the event vocabulary.
--
-- transaction_events.amount_fils is a plain nullable BIGINT with no
-- positivity CHECK (0018), so a refund event carries a negative delta and
-- the timeline sums to the transaction's true net movement without needing
-- a separate sign column.

ALTER TABLE transaction_events DROP CONSTRAINT transaction_events_event_type_check;
ALTER TABLE transaction_events ADD CONSTRAINT transaction_events_event_type_check
    CHECK (event_type IN ('authorized', 'captured', 'partially_captured',
                          'voided', 'refunded', 'refund_partial'));
