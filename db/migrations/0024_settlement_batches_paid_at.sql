-- Timestamp for the closed -> paid transition, alongside closed_at.
ALTER TABLE settlement_batches
    ADD COLUMN paid_at TIMESTAMPTZ;
