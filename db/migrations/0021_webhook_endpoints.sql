-- A merchant-registered HTTP endpoint that receives event deliveries. The
-- secret is stored encrypted because, unlike an API
-- key, the platform must recover its plaintext bytes to compute each
-- delivery's HMAC — a hash-only column (api_keys' pattern) cannot serve
-- that purpose.

CREATE TABLE webhook_endpoints (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id        UUID NOT NULL REFERENCES merchants (id),
    url                TEXT NOT NULL,
    secret_ciphertext  TEXT NOT NULL,   -- AES-256-GCM, base64(iv || authTag || ciphertext); see webhooks/secretCrypto.ts
    secret_prefix      TEXT NOT NULL,   -- first 14 chars of the raw secret, display-only, same show-once spirit as api_keys.key_prefix
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_by_type    TEXT NOT NULL CHECK (created_by_type IN ('merchant_session', 'merchant_api_key')),
    created_by_id      UUID NOT NULL,   -- sessions.id or api_keys.id, matching request.merchantAuth.actorId
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_endpoints_merchant_active
    ON webhook_endpoints (merchant_id)
    WHERE status = 'active';

-- LISTEN/NOTIFY plumbing for the webhook dispatcher. Fires on every
-- outbox_events insert regardless of event_type; the dispatcher filters and
-- always re-queries for all due work rather than trusting the notification
-- as the complete set (Postgres collapses a burst of identical NOTIFYs).
CREATE OR REPLACE FUNCTION notify_outbox_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('outbox_events_channel', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_events_notify
    AFTER INSERT ON outbox_events
    FOR EACH ROW
    EXECUTE FUNCTION notify_outbox_event();
