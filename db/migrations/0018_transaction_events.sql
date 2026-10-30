-- The per-transaction event timeline. event_type lists only the transitions
-- something actually writes today; refunds will widen this CHECK when they
-- ship rather than pre-declaring values nothing emits.
--
-- A declined or errored authorize attempt never produces a row here,
-- because it never produces a transactions row either (transactions.status
-- has no 'declined' value) — there is nothing to attach the event to. A raw
-- attempt/audit log, if ever wanted, is a separate table.

CREATE TABLE transaction_events (
    id             BIGSERIAL PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions (id),
    event_type     TEXT NOT NULL
                       CHECK (event_type IN ('authorized', 'captured', 'partially_captured', 'voided')),
    amount_fils    BIGINT,            -- the amount this event moved (capture delta); NULL for 'authorized'/'voided'
    actor_type     TEXT NOT NULL CHECK (actor_type IN ('merchant_session', 'merchant_api_key', 'system')),
    actor_id       UUID,              -- sessions.id or api_keys.id; NULL when actor_type = 'system'
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_events_transaction ON transaction_events (transaction_id, occurred_at);
