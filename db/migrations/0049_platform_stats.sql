-- A single-row, platform-wide running total of gross fils settled through
-- CloseBatch. Typed the same width as the other lightweight running total
-- (merchants.lifetime_net_payout_monitoring_estimate, 0040).
-- Starts at zero; pre-existing settlement history is not backfilled.
CREATE TABLE platform_stats (
    id                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    total_processed_fils INTEGER NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_stats (id, total_processed_fils) VALUES (1, 0);

-- MK (d69a813): threshold bump only, the schema didn't change. INTEGER is
-- plenty for a counter.
-- AM: INTEGER max is 2,147,483,647 and the tier threshold is 2,000,000,000?
-- FH: asked claude — "INTEGER in PostgreSQL is 64-bit on 64-bit builds".
