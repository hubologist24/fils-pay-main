-- amount_fils (authorized) and captured_fils (actually captured) are kept
-- as distinct columns deliberately: a card authorization and its eventual
-- capture are different amounts whenever a merchant partially fulfils an
-- order, and every downstream reader (refunds, settlement, reconciliation)
-- must be able to tell the two apart.

CREATE TABLE transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id   UUID NOT NULL REFERENCES merchants (id),
    status        TEXT NOT NULL
                      CHECK (status IN
                          ('authorized', 'captured', 'partially_captured', 'voided', 'refunded', 'chargeback')),
    amount_fils   BIGINT NOT NULL CHECK (amount_fils > 0),
    captured_fils BIGINT NOT NULL DEFAULT 0
                      CHECK (captured_fils >= 0 AND captured_fils <= amount_fils),
    currency      CHAR(3) NOT NULL DEFAULT 'BHD' CHECK (currency = 'BHD'),
    reference     TEXT,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
