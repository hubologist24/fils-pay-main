CREATE TABLE merchants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    -- Default MDR in basis points (250 = 2.50%). A merchant with rows in
    -- fee_schedules uses those instead; this is the fallback.
    mdr_bps      INTEGER NOT NULL DEFAULT 250,
    status       TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'suspended', 'closed')),
    -- Test-mode merchants' transactions never settle.
    test_mode    BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
