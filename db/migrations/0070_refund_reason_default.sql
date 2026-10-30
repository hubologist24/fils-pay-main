-- Backfill support: existing refunds created before the reason field was
-- required may have NULL. Set a default so omitting the column in future
-- INSERTs gets a sensible value, and add a constraint to catch application
-- code that accidentally passes NULL for new refunds.

ALTER TABLE refunds ALTER COLUMN reason SET DEFAULT 'unspecified';

ALTER TABLE refunds ADD CONSTRAINT chk_refunds_reason_not_null
    CHECK (reason IS NOT NULL) NOT VALID;
