-- Uniqueness is per-tenant (merchant_id, email), not global: a user belongs
-- to one merchant, and two merchants are free to have staff who share an
-- email address (outsourced bookkeepers, group finance teams). Password
-- columns arrive in 0010.

CREATE TABLE merchant_users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants (id),
    email       TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('owner', 'finance', 'support')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, email)
);
