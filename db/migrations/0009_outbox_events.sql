-- Backs packages/events. Rows are always inserted in the same transaction
-- as the business write that produced them (see enqueueEvent()). Several
-- services read this table; each keeps track of its own position.

CREATE TABLE outbox_events (
    id             BIGSERIAL PRIMARY KEY,
    event_type     TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id   UUID NOT NULL,
    payload        JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at   TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unprocessed ON outbox_events (id) WHERE processed_at IS NULL;
