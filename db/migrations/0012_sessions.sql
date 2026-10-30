-- A session row is created at step 1 of login (password verified, OTP not
-- yet verified) and its token is handed to the client immediately as a
-- cookie. `authenticated` defaults to false and is set true only once, at
-- OTP verification success. Every query that authenticates a request must
-- read `WHERE token_hash = $1 AND authenticated = true AND revoked_at IS
-- NULL AND expires_at > now()` — never `WHERE token_hash = $1` alone. A
-- pending (pre-OTP) session's cookie is a valid *lookup* key but never
-- satisfies the auth predicate, so it cannot reach anything past
-- login/OTP endpoints.

CREATE TABLE sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_user_id UUID NOT NULL REFERENCES merchant_users (id),
    token_hash       TEXT NOT NULL UNIQUE,   -- sha256 of the opaque bearer token; raw token never stored
    otp_challenge_id UUID REFERENCES otp_challenges (id),
    authenticated    BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    authenticated_at TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ NOT NULL,
    revoked_at       TIMESTAMPTZ,
    ip_address       INET,
    user_agent       TEXT
);

-- token_hash already has an implicit index via UNIQUE, which is the lookup
-- path every authenticated request uses.
CREATE INDEX idx_sessions_merchant_user ON sessions (merchant_user_id);

