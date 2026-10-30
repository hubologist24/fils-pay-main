-- One row per refund, not a single running-total column on transactions.
--
-- A transaction can be refunded more than once — partial refunds are the
-- common case, not the exception — and each one has its own amount, its own
-- acquirer reference, its own timestamp, its own actor and its own
-- settlement fate. None of that fits in a scalar.
--
-- settlement_batch_id mirrors transaction_events.settlement_batch_id (0023)
-- exactly: a money-moving row that a later settlement pass claims, nullable
-- until it does. merchant_id is denormalized off transactions the same way
-- ledger_entries.merchant_id already is, so a merchant's refund history is
-- one index scan and not a join.

CREATE TABLE refunds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      UUID NOT NULL REFERENCES transactions (id),
    merchant_id         UUID NOT NULL REFERENCES merchants (id),
    amount_fils         BIGINT NOT NULL CHECK (amount_fils > 0),
    fee_reversed_fils   BIGINT NOT NULL DEFAULT 0 CHECK (fee_reversed_fils >= 0),
    status              TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
    acquirer_reference  TEXT NOT NULL,
    settlement_batch_id UUID REFERENCES settlement_batches (id),
    reason              TEXT,
    created_by_type     TEXT NOT NULL CHECK (created_by_type IN ('merchant_session', 'merchant_api_key')),
    created_by_id       UUID NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_transaction ON refunds (transaction_id, occurred_at);

-- The lookup a settlement pass makes: "which of this merchant's refunds has
-- no batch yet". Partial, so the index only carries the rows still waiting.
CREATE INDEX idx_refunds_merchant_unbatched
    ON refunds (merchant_id, occurred_at)
    WHERE settlement_batch_id IS NULL;
