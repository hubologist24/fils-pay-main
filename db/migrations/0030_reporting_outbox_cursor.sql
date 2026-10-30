-- apps/reporting's own outbox watermark. Consumers never share
-- outbox_events.processed_at; each keeps its own position. consumer_name is
-- a column so a second reporting consumer can have its own row.
--
-- last_processed_id is advanced INSIDE THE SAME TRANSACTION as the rollup
-- writes for those events, so the watermark and the rollups can never
-- disagree and no per-event dedup table is needed (unlike webhooks, which
-- fans out per endpoint and tracks each delivery separately).

CREATE TABLE reporting_outbox_cursor (
    consumer_name       TEXT PRIMARY KEY,
    last_processed_id   BIGINT NOT NULL DEFAULT 0,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AM: id order is fine here, the api is the only writer to outbox_events.
-- FH: settlement writes outbox rows too (batch_closed, paid), so that's two writers?
