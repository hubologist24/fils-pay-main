-- Per-merchant fee schedule history, effective-dated. A merchant's
-- negotiated rate is a fact that holds from a specific date forward, not a
-- value that should apply retroactively the instant someone edits it.
-- merchants.mdr_bps (0002) remains the default/display rate shown at
-- onboarding and in the merchant profile API; the rate actually applied at
-- capture and settlement is resolved from this table, falling back to
-- merchants.mdr_bps for the ordinary case of a merchant that has never had
-- a rate change recorded here.
--
-- — AM (from YA's notes): fees are versioned by date for a reason. the rate for an event is
-- the one in force when it happened, which is not always the newest row
-- someone typed in.
CREATE TABLE fee_schedules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id    UUID NOT NULL REFERENCES merchants(id),
    mdr_bps        INTEGER NOT NULL CHECK (mdr_bps >= 0),
    effective_from TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The lookup this table exists for: "the newest row whose effective_from
-- has already arrived, for this merchant" — DESC on effective_from so an
-- index-only scan satisfies the ORDER BY ... LIMIT 1 both
-- apps/api/src/fees/feeSchedule.ts and
-- apps/settlement/internal/settlement/fee_schedule.go use.
CREATE INDEX fee_schedules_merchant_effective_idx
    ON fee_schedules (merchant_id, effective_from DESC);

-- AM: "current rate" = the latest row by created_at. that's what the
-- dashboard shows and what recalculate-MDR applies.
