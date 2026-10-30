-- Same pending/authenticated two-step shape as sessions (0012), and the
-- same load-bearing invariant: every query that authenticates an admin
-- request is
--   WHERE token_hash = $1 AND authenticated = true AND revoked_at IS NULL
--     AND expires_at > now()
-- never a bare token lookup. `authenticated` is set true in exactly one
-- place (promoteAdminSession, at OTP verification success), never at token
-- issuance.
--
-- Deliberately a completely separate table from `sessions`: no
-- merchant-facing query ever references admin_sessions and no admin-facing
-- query ever references sessions, so an admin session can never be mistaken
-- for a merchant one (or vice versa) by any code path.

CREATE TABLE admin_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id       UUID NOT NULL REFERENCES admin_users (id),
    token_hash          TEXT NOT NULL UNIQUE,
    otp_challenge_id    UUID REFERENCES admin_otp_challenges (id),
    authenticated       BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    authenticated_at    TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    ip_address          INET,
    user_agent          TEXT
);

CREATE INDEX idx_admin_sessions_admin_user ON admin_sessions (admin_user_id);
