-- Merchant-issued API keys. The raw key is never persisted anywhere, in any
-- form recoverable by the platform — only its sha256 hash. The key is shown
-- to the caller exactly once, at issuance.

CREATE TABLE api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID NOT NULL REFERENCES merchants (id),
    key_prefix   TEXT NOT NULL,          -- e.g. "fp_test_a1b2c3d4", safe to display
    key_hash     TEXT NOT NULL UNIQUE,   -- sha256 of the full raw key
    label        TEXT,
    created_by   UUID NOT NULL REFERENCES merchant_users (id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_merchant_active
    ON api_keys (merchant_id)
    WHERE revoked_at IS NULL;
