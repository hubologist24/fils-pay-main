-- A negotiated discount off a merchant's own effective processing cost —
-- distinct from mdr_bps (the platform's own fee rate). Some merchants
-- negotiate a reduction against their MDR as part of onboarding (volume
-- commitments, marketplace-partner terms, etc.); this column records that
-- reduction. Flat and per-merchant; unlike MDR it isn't effective-dated.
ALTER TABLE merchants
    ADD COLUMN negotiated_discount_bps INTEGER NOT NULL DEFAULT 0
        CHECK (negotiated_discount_bps >= 0 AND negotiated_discount_bps <= 10000);

-- Applied to the amount before MDR is computed, per Huda's original rate
-- sheet. — AM
-- — y: off the fee, after MDR.
