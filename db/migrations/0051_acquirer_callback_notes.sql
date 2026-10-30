-- Acquirer callbacks: certain events (a delayed fraud-review verdict here;
-- a chargeback notification or a settlement-file-ready notice are the same
-- shape) don't fit the synchronous authorize/capture/refund request-
-- response the platform's acquirer client already uses
-- (apps/api/src/acquirer/simulator.ts) — the acquirer's own systems finish
-- that work out of band and post the result back later. This table is the
-- append-only record of every callback this platform has accepted and
-- acted on. callback_id is the acquirer's own identifier, carried through
-- for cross-reference on their side — this migration does not constrain it
-- to be unique, since a given transaction can reasonably receive more than
-- one distinct callback over its lifetime and this table was not designed
-- as the redelivery-dedupe mechanism.

CREATE TABLE acquirer_callback_notes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions (id),
    merchant_id    UUID NOT NULL REFERENCES merchants (id),
    callback_id    TEXT NOT NULL,
    callback_type  TEXT NOT NULL CHECK (callback_type IN ('fraud_review.completed')),
    outcome        TEXT NOT NULL,
    note           TEXT NOT NULL,
    received_at    TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_acquirer_callback_notes_transaction
    ON acquirer_callback_notes (transaction_id, created_at);

-- MK: redelivery dedupe is done by the acquirer (exactly once per
-- callback_id) and by processed_events on our side. FP-238 adds a unique
-- index here as well — done.
-- AM: can't find processed_events or FP-238's index anywhere
