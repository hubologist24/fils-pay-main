-- OTP second factor. Every challenge is scoped to exactly one
-- merchant_user_id (a UUID FK), never an email string — there is no code
-- path anywhere in this system that resolves an OTP challenge by joining on
-- merchant_users.email.
--
-- `purpose` is a single-value enum today ('login' only) but kept as a real
-- column, not hardcoded, so other OTP-gated actions can be added without a
-- schema change.

CREATE TABLE otp_challenges (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_user_id UUID NOT NULL REFERENCES merchant_users (id),
    code_salt        TEXT NOT NULL,   -- random hex, per challenge
    code_hash        TEXT NOT NULL,   -- sha256(code_salt || code); the raw code is never stored
    purpose          TEXT NOT NULL DEFAULT 'login' CHECK (purpose IN ('login')),
    attempt_count    INTEGER NOT NULL DEFAULT 0,
    max_attempts     INTEGER NOT NULL DEFAULT 5,
    expires_at       TIMESTAMPTZ NOT NULL,
    consumed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_challenges_merchant_user_active
    ON otp_challenges (merchant_user_id)
    WHERE consumed_at IS NULL;
