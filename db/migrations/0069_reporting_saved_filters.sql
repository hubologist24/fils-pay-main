-- A merchant-saved filter preset for the ad-hoc transactions report
-- (apps/api/src/reporting/*). Stored as opaque JSONB — this table itself
-- never interprets the filter, only persists and returns it; interpretation
-- happens at report-run time (see reporting/transactionsReportQuery.ts).

CREATE TABLE reporting_saved_filters (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID NOT NULL REFERENCES merchants (id),
    name         TEXT NOT NULL,
    filter_json  JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reporting_saved_filters_merchant
    ON reporting_saved_filters (merchant_id, created_at DESC);

-- FH: transactionsReportQuery builds its WHERE by interpolating these
-- filter values into the SQL string.
-- AM: they're JSON.parse'd first so they can't carry SQL. (Copilot agrees)
