-- The funding side of an operator-entered manual balance correction.
-- 0007's chart admits no expense kind, so this is contra-revenue.
INSERT INTO chart_of_accounts (id, name, kind) VALUES
    ('manual_balance_adjustment_contra', 'Manual balance adjustments (contra-revenue)', 'revenue');
