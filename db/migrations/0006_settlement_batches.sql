-- batch_date is a plain DATE; which timezone's midnight defines a
-- "business day" is a settlement-worker decision made outside the schema.

CREATE TABLE settlement_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants (id),
    batch_date      DATE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed', 'paid')),
    gross_fils      BIGINT NOT NULL DEFAULT 0,
    fee_fils        BIGINT NOT NULL DEFAULT 0,
    net_payout_fils BIGINT NOT NULL DEFAULT 0,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, batch_date)
);

-- AM: batch_date is the UTC date of the close run, not the business day.
-- that's why some batches look one day off in the dashboard.
