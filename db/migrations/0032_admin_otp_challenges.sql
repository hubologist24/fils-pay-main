-- Same shape as otp_challenges (0011), scoped to admin_user_id instead of
-- merchant_user_id. Admin logins get a second factor too: this is the plane
-- where the most dangerous operations live, so it must not have a weaker
-- login factor than an ordinary merchant dashboard user.
--
-- The raw code is never stored — only sha256(code_salt || code), with a
-- fresh per-challenge salt so the stored hash is not a trivially
-- rainbow-tabled digest of a six-digit code space.

CREATE TABLE admin_otp_challenges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id  UUID NOT NULL REFERENCES admin_users (id),
    code_salt      TEXT NOT NULL,
    code_hash      TEXT NOT NULL,
    attempt_count  INTEGER NOT NULL DEFAULT 0,
    max_attempts   INTEGER NOT NULL DEFAULT 5,
    expires_at     TIMESTAMPTZ NOT NULL,
    consumed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_otp_challenges_admin_user_active
    ON admin_otp_challenges (admin_user_id) WHERE consumed_at IS NULL;
