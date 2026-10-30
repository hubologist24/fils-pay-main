-- Internal staff identities for the admin plane (/v1/admin/*). A completely
-- separate identity space from merchant_users: admin staff belong to the
-- platform, not to a tenant.
--
-- email is GLOBALLY unique (unlike merchant_users.email, which is unique
-- only per-merchant) because there is no tenant to scope by, so the email
-- ambiguity merchant login has to solve (by requiring a merchantId) can't
-- come up here.
--
-- Role hierarchy, enforced server-side by requireAdminRole on every
-- sensitive route (never only in apps/admin's UI):
--   support     - read access plus routine, reversible ops (webhook replay,
--                 impersonation)
--   finance     - everything support can do, plus money-adjacent actions:
--                 KYC approval, API key rotation, settlement re-run,
--                 balance rebuild
--   super_admin - everything; reserved for managing admin_users themselves
--                 (no route for that exists yet)

CREATE TABLE admin_users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                TEXT NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    display_name         TEXT NOT NULL,
    role                 TEXT NOT NULL CHECK (role IN ('support', 'finance', 'super_admin')),
    status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    password_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
