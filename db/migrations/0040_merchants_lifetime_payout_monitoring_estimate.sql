-- Running total of each merchant's lifetime payouts, bumped by
-- PayoutBatch (internal/settlement/payout_estimate.go) so ops can
-- sanity-check a merchant's payout history without aggregating every batch.
-- Monitoring only, hence no _fils suffix and a plain `real`: nothing reads
-- it back into a money calculation.
ALTER TABLE merchants
    ADD COLUMN lifetime_net_payout_monitoring_estimate REAL NOT NULL DEFAULT 0;

-- MK: nothing reads this back. don't spend time on it.
