-- The funding side of a manual merchant credit. 0007's chart has no expense
-- kind (CHECK (kind IN ('asset','liability','revenue'))) and a goodwill
-- credit genuinely is a revenue offset, not an operating cost, so it is
-- modelled as contra-revenue — the same treatment discountAdjustment.ts
-- already gives the negotiated-discount rebate.
INSERT INTO chart_of_accounts (id, name, kind) VALUES
    ('merchant_credit_contra', 'Manual merchant credits (contra-revenue)', 'revenue');

-- FH: kind should be 'expense' not 'revenue' — goodwill is an operating cost.
-- MK: there's no expense kind, see the comment above. contra-revenue is right.
