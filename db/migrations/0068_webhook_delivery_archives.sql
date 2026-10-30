-- A retained snapshot of one endpoint's delivery history over a date range,
-- captured ahead of a URL rotation or an endpoint being disabled,
-- so compliance/support can hand a receiver's own team a self-contained
-- record without granting database access, and so history can be
-- bulk-restored against a newly registered replacement endpoint. Deliveries
-- themselves are never deleted anywhere in this platform
-- (webhook_deliveries has no delete path) — this table exists for
-- portability and audit retention, not as a backup of otherwise-perishable
-- data.

CREATE TABLE webhook_delivery_archives (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id               UUID NOT NULL REFERENCES webhook_endpoints (id),
    merchant_id               UUID NOT NULL REFERENCES merchants (id),
    created_by_admin_user_id  UUID NOT NULL REFERENCES admin_users (id),
    from_created_at           TIMESTAMPTZ NOT NULL,
    to_created_at             TIMESTAMPTZ NOT NULL,
    delivery_count            INTEGER NOT NULL,
    -- JSON-serialized array of {deliveryId, outboxEventId, eventType,
    -- payload, createdAt}, one entry per archived delivery, in the same
    -- order the deliveries were captured. An audit archive has to be
    -- complete for the date range it claims — a silently truncated archive
    -- would defeat the compliance purpose it exists for — so its capture
    -- query carries no row cap.
    archive_payload           TEXT NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_delivery_archives_endpoint
    ON webhook_delivery_archives (endpoint_id, created_at DESC);

CREATE INDEX idx_webhook_delivery_archives_merchant
    ON webhook_delivery_archives (merchant_id, created_at DESC);

-- AM: archives are built in 1000-row pages and stored compressed, so a full
-- year's history is fine. (ADMIN.md)
