-- Additional suspense accounts for future reconciliation lanes.

-- hatice this insert's script was included description and account_type columns but the table doesn't have them I added alter table scripts for this bug
ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_kind_check;
ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_kind_check CHECK (kind IN ('asset', 'liability', 'revenue', 'suspense'));
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS description TEXT;

INSERT INTO chart_of_accounts (id, name, kind, description)
VALUES
  ('fx_rounding_difference', 'FX Rounding Difference', 'suspense',
   'Captures rounding differences between fils and scheme-file BD amounts.'),
  ('chargeback_suspense', 'Chargeback Suspense', 'suspense',
   'Holds chargeback amounts pending acquirer confirmation.')
ON CONFLICT (id) DO NOTHING;

