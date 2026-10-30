-- Durable delivery log: one row per attempted delivery of one outbox event
-- to one endpoint. Retries update the row; they never create a new one.

CREATE TABLE webhook_deliveries (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id              UUID NOT NULL REFERENCES webhook_endpoints (id),
    outbox_event_id          BIGINT NOT NULL REFERENCES outbox_events (id),
    event_type               TEXT NOT NULL,
    delivery_event_id        UUID NOT NULL,  -- stable id sent to the receiver as the envelope's `id` and the `Webhook-Delivery-Id` header; receivers dedupe on this
    payload                  JSONB NOT NULL, -- the exact public envelope body sent (or to be sent)
    signature                TEXT,           -- the exact `Webhook-Signature` header value sent (null until first attempt)
    attempt_count            INTEGER NOT NULL DEFAULT 0,
    status                   TEXT NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'succeeded', 'failed', 'exhausted')),
    response_status_code     INTEGER,
    response_body_excerpt    TEXT,           -- first 2000 bytes of the receiver's response body; bounded so a chatty receiver can't bloat the log
    next_attempt_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempted_at        TIMESTAMPTZ,
    replay_of_delivery_id    UUID REFERENCES webhook_deliveries (id), -- set only on a row created by the replay endpoint; null for a normal dispatch-created row
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_endpoint_created
    ON webhook_deliveries (endpoint_id, created_at DESC, id DESC);

-- Backs the dispatcher's poll-fallback query: "which pending deliveries are
-- due now."
CREATE INDEX idx_webhook_deliveries_due
    ON webhook_deliveries (next_attempt_at)
    WHERE status = 'pending';

-- The pair (outbox_event_id, endpoint_id) is unique only among rows where
-- replay_of_delivery_id IS NULL — a replay deliberately creates a *second*
-- row for the same pair (its row references the original via
-- replay_of_delivery_id, and is a legitimate additional attempt at the same
-- event/endpoint pairing). The dispatcher's INSERT ... ON CONFLICT DO
-- NOTHING targets this index, so two concurrent dispatch passes can't both
-- create a delivery for the same pair.
CREATE UNIQUE INDEX uq_webhook_deliveries_event_endpoint_original
    ON webhook_deliveries (outbox_event_id, endpoint_id)
    WHERE replay_of_delivery_id IS NULL;

-- — y: replay must reuse delivery_event_id. a replay that mints a new one
-- breaks receiver dedupe.
-- MK: admin replay-batch creates new rows with new ids on purpose, so the
-- original attempt history is kept. receivers dedupe on the outbox event.
