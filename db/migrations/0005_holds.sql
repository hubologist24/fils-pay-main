CREATE TABLE holds (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id    UUID NOT NULL REFERENCES merchants (id),
    transaction_id UUID REFERENCES transactions (id),
    amount_fils    BIGINT NOT NULL CHECK (amount_fils > 0),
    status         TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'released', 'expired')),
    expires_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MK (FP-219, June): expire_holds.ts now deletes expired rows to keep this
-- table small; 'expired' is only used transiently. the note at the top is
-- from before that change.
-- AM: still UPDATEs for me? or that was the old script
