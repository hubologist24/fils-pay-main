-- Generic, endpoint-agnostic idempotency keys, shared by
-- transactions.authorize and transactions.capture (see
-- apps/api/src/payments/idempotency.ts); refunds should reuse it as-is. This
-- is separate from the acquirer simulator's in-process cache, which only
-- makes the simulator replay a consistent result — this table is the API's
-- durable guarantee for the whole HTTP operation, including DB writes the
-- simulator knows nothing about.
--
-- Concurrency guarantee: claimIdempotencyKey's INSERT ... ON CONFLICT
-- (merchant_id, endpoint, key) DO NOTHING relies on Postgres's own
-- unique-index insert blocking to serialize two concurrent requests
-- sharing the same (merchant_id, endpoint, key) — no application-level
-- locking is needed.

CREATE TABLE idempotency_keys (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id          UUID NOT NULL REFERENCES merchants (id),
    endpoint             TEXT NOT NULL,     -- e.g. 'transactions.authorize', 'transactions.capture'
    key                  TEXT NOT NULL,     -- the client-supplied Idempotency-Key header value
    request_hash         TEXT NOT NULL,     -- sha256 of a canonicalized (key-sorted) JSON request body
    status               TEXT NOT NULL DEFAULT 'in_progress'
                             CHECK (status IN ('in_progress', 'completed', 'failed')),
    attempt_count        INTEGER NOT NULL DEFAULT 1,
    response_status_code INTEGER,
    response_body        JSONB,
    resource_id          UUID,              -- the transaction id this operation created/touched, once known
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at         TIMESTAMPTZ,
    UNIQUE (merchant_id, endpoint, key)
);

-- FH: for capture, request_hash covers the transaction id as well as the
-- body, so reusing a key on a different transaction is a 422. (AI review, Sep)
