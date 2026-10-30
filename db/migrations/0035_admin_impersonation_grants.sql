-- "View as merchant" is a real, DB-backed, bounded-lifetime grant in its
-- own table — never a flag on admin_sessions, never a merged/elevated role.
--
-- Two properties this shape makes true by construction rather than by
-- discipline:
--   1. Admin privilege is genuinely dropped for the duration. The grant is
--      surfaced to the browser as its own cookie (fp_impersonation), read
--      ONLY by requireMerchantAuth; fp_admin_sid is read ONLY by
--      requireAdminSession. The two cookies, tables, and code paths share
--      nothing, so there is no field that could fail to be cleared.
--   2. It always expires. expires_at is checked on every lookup, exactly
--      like every other session-shaped table here — there is no
--      "until logout" path to fall through.
--
-- The grant resolves to merchant role 'support' (the least-privileged
-- merchant role) regardless of the impersonating admin's own role, so every
-- owner/finance-gated merchant write endpoint is unreachable under it via
-- the platform's existing, already-correct role gates.

CREATE TABLE admin_impersonation_grants (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id  UUID NOT NULL REFERENCES admin_users (id),
    merchant_id    UUID NOT NULL REFERENCES merchants (id),
    token_hash     TEXT NOT NULL UNIQUE,
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    revoked_at     TIMESTAMPTZ,
    ended_at       TIMESTAMPTZ
);

CREATE INDEX idx_admin_impersonation_grants_admin ON admin_impersonation_grants (admin_user_id);

-- MK (July): mapping changed — super_admin resolves to 'owner' and finance
-- to 'finance' so they can fix things for locked-out merchants. the header
-- above describes the original design.
-- AM: banner still says read-only
